"""Configurable upload storage with a safe local default and optional Aliyun OSS."""

import os
from dataclasses import dataclass
from pathlib import Path


class StorageNotConfigured(RuntimeError):
    """Raised when object storage was explicitly enabled without usable settings."""


class StorageImageInvalid(ValueError):
    """Raised when a certificate image is not a safe managed upload."""


class StorageReadFailed(RuntimeError):
    """Raised when managed object storage could not read a certificate image."""


class StorageWriteFailed(RuntimeError):
    """Raised when managed storage could not persist an uploaded file."""


@dataclass(frozen=True)
class StoredFile:
    filename: str
    url: str
    size: int


@dataclass(frozen=True)
class StoredImage:
    content: bytes
    mime_type: str


class StorageService:
    """Persist uploads locally unless Aliyun OSS has been explicitly enabled."""

    def __init__(self, config):
        self.config = config

    def save(self, file_storage, filename):
        if self.config.get('OSS_ENABLED', False):
            return self._save_to_oss(file_storage, filename)
        return self._save_locally(file_storage, filename)

    def read_certificate_image(self, reference):
        if self.config.get('OSS_ENABLED', False):
            return self._read_oss_certificate_image(reference)
        if _is_local_certificate_reference(reference):
            return self._read_local_certificate_image(reference)
        raise StorageImageInvalid('Certificate image is not a managed upload')

    def _save_locally(self, file_storage, filename):
        upload_folder = self.config['UPLOAD_FOLDER']
        path = os.path.join(upload_folder, filename)
        try:
            os.makedirs(upload_folder, exist_ok=True)
            file_storage.save(path)
            size = os.path.getsize(path)
        except OSError as exc:
            raise StorageWriteFailed('Local upload storage could not be written') from exc
        return StoredFile(filename=filename, url=f'/uploads/{filename}', size=size)

    def _save_to_oss(self, file_storage, filename):
        prefix = _oss_prefix(self.config)
        object_key = f'{prefix}/{filename}' if prefix else filename
        size = _stream_size(file_storage.stream)
        file_storage.stream.seek(0)
        bucket = self._oss_bucket()
        try:
            bucket.put_object(object_key, file_storage.stream)
        except StorageNotConfigured:
            raise
        except Exception as exc:
            raise StorageWriteFailed('Object storage upload could not be written') from exc
        return StoredFile(
            filename=filename,
            url=_oss_public_url(self.config, object_key),
            size=size,
        )

    def _read_local_certificate_image(self, reference):
        filename = reference.removeprefix('/uploads/')
        mime_type = _certificate_image_mime_type(filename)
        if mime_type is None:
            raise StorageImageInvalid('Certificate image format is not supported')

        try:
            upload_folder = Path(self.config['UPLOAD_FOLDER']).resolve()
            path = (upload_folder / filename).resolve()
            path.relative_to(upload_folder)
        except (KeyError, OSError, TypeError, ValueError) as exc:
            raise StorageImageInvalid('Certificate image is not a managed upload') from exc

        try:
            if not path.is_file():
                raise StorageImageInvalid('Certificate image does not exist')
            with path.open('rb') as image_file:
                content = image_file.read(self._max_certificate_image_size() + 1)
        except StorageImageInvalid:
            raise
        except OSError as exc:
            raise StorageImageInvalid('Certificate image cannot be read') from exc

        return StoredImage(
            content=self._validated_certificate_image_content(content),
            mime_type=mime_type,
        )

    def _read_oss_certificate_image(self, reference):
        public_prefix = _oss_public_url(self.config, '')
        object_key = _oss_certificate_object_key(reference, self.config, public_prefix)
        mime_type = _certificate_image_mime_type(object_key.rsplit('/', 1)[-1])
        if mime_type is None:
            raise StorageImageInvalid('Certificate image format is not supported')

        bucket = self._oss_bucket()
        max_size = self._max_certificate_image_size()
        result = None
        try:
            result = bucket.get_object(object_key)
            content = result.read(max_size + 1)
        except Exception as exc:
            raise StorageReadFailed('Certificate image storage could not be read') from exc
        finally:
            if result is not None:
                close = getattr(result, 'close', None)
                if callable(close):
                    try:
                        close()
                    except Exception as exc:
                        raise StorageReadFailed('Certificate image storage could not be closed') from exc

        return StoredImage(
            content=self._validated_certificate_image_content(content),
            mime_type=mime_type,
        )

    def _max_certificate_image_size(self):
        try:
            max_size = int(self.config['MAX_CONTENT_LENGTH'])
        except (KeyError, TypeError, ValueError) as exc:
            raise StorageImageInvalid('Certificate image size limit is invalid') from exc
        if max_size <= 0:
            raise StorageImageInvalid('Certificate image size limit is invalid')
        return max_size

    def _validated_certificate_image_content(self, content):
        if not isinstance(content, bytes) or not content:
            raise StorageImageInvalid('Certificate image is empty or invalid')
        if len(content) > self._max_certificate_image_size():
            raise StorageImageInvalid('Certificate image exceeds the size limit')
        return content

    def _oss_bucket(self):
        required = ('OSS_ACCESS_KEY_ID', 'OSS_ACCESS_KEY_SECRET', 'OSS_BUCKET', 'OSS_ENDPOINT')
        provider = self.config.get('OSS_PROVIDER', 'aliyun')
        if (
            not isinstance(provider, str)
            or provider.lower() != 'aliyun'
            or any(not isinstance(self.config.get(name), str) or not self.config.get(name) for name in required)
        ):
            raise StorageNotConfigured('Aliyun OSS settings are incomplete')
        _validate_oss_url(self.config['OSS_ENDPOINT'], 'OSS endpoint')

        try:
            import oss2
        except ImportError as exc:
            raise StorageNotConfigured('oss2 is not installed') from exc

        try:
            auth = oss2.Auth(
                self.config['OSS_ACCESS_KEY_ID'], self.config['OSS_ACCESS_KEY_SECRET']
            )
            return oss2.Bucket(auth, self.config['OSS_ENDPOINT'], self.config['OSS_BUCKET'])
        except Exception as exc:
            raise StorageNotConfigured('Aliyun OSS client could not be configured') from exc


def _stream_size(stream):
    current = stream.tell()
    stream.seek(0, os.SEEK_END)
    size = stream.tell()
    stream.seek(current)
    return size


def _certificate_image_mime_type(filename):
    return {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
    }.get(Path(filename).suffix.lower())


def _oss_public_url(config, object_key):
    public_base_url = config.get('OSS_PUBLIC_BASE_URL', '')
    if public_base_url:
        _validate_oss_url(public_base_url, 'OSS public base URL')
        public_base_url = public_base_url.rstrip('/')
        return f'{public_base_url}/{object_key}'
    endpoint = config.get('OSS_ENDPOINT')
    scheme, host = _validate_oss_url(endpoint, 'OSS endpoint')
    bucket = config.get('OSS_BUCKET')
    if not isinstance(bucket, str) or not bucket:
        raise StorageNotConfigured('Aliyun OSS settings are incomplete')
    return f'{scheme}://{bucket}.{host.rstrip("/")}/{object_key}'


def _is_local_certificate_reference(reference):
    if not isinstance(reference, str) or not reference.startswith('/uploads/'):
        return False
    filename = reference.removeprefix('/uploads/')
    return _is_safe_certificate_basename(filename)


def _oss_certificate_object_key(reference, config, public_prefix):
    if not isinstance(reference, str) or not reference.startswith(public_prefix):
        raise StorageImageInvalid('Certificate image is not a managed upload')

    object_key = reference.removeprefix(public_prefix)
    configured_prefix = _oss_prefix(config)
    filename = object_key
    if configured_prefix:
        expected_prefix = f'{configured_prefix}/'
        if not object_key.startswith(expected_prefix):
            raise StorageImageInvalid('Certificate image is not a managed upload')
        filename = object_key.removeprefix(expected_prefix)

    if not _is_safe_certificate_basename(filename) or '%' in filename:
        raise StorageImageInvalid('Certificate image is not a managed upload')
    return object_key


def _oss_prefix(config):
    prefix = config.get('OSS_PREFIX', '')
    if not isinstance(prefix, str):
        raise StorageNotConfigured('Aliyun OSS prefix is invalid')
    return prefix.strip('/')


def _validate_oss_url(value, setting_name):
    if not isinstance(value, str):
        raise StorageNotConfigured(f'{setting_name} is invalid')
    scheme, separator, host = value.rstrip('/').partition('://')
    if (
        separator != '://'
        or scheme not in ('http', 'https')
        or not host
        or any(character.isspace() or ord(character) < 32 for character in host)
        or any(character in host for character in '?#')
    ):
        raise StorageNotConfigured(f'{setting_name} is invalid')
    return scheme, host


def _is_safe_certificate_basename(filename):
    return bool(filename) and not any(
        character in '/\\?#:' or ord(character) < 32 or ord(character) == 127
        for character in filename
    )
