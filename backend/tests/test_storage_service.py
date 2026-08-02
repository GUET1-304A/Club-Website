import io
import socket
import sys
import types

import pytest

from services import storage_service
from services.storage_service import (
    StorageImageInvalid,
    StorageNotConfigured,
    StorageReadFailed,
    StorageService,
    StoredImage,
    _is_local_certificate_reference,
)


def _local_config(upload_folder, max_content_length=1024):
    return {
        'UPLOAD_FOLDER': str(upload_folder),
        'MAX_CONTENT_LENGTH': max_content_length,
    }


def _oss_config(upload_folder, **overrides):
    return {
        **_local_config(upload_folder),
        'OSS_ENABLED': True,
        'OSS_PROVIDER': 'aliyun',
        'OSS_ACCESS_KEY_ID': 'key-id',
        'OSS_ACCESS_KEY_SECRET': 'key-secret',
        'OSS_BUCKET': 'certificates',
        'OSS_ENDPOINT': 'https://oss.example.test',
        'OSS_PREFIX': 'managed',
        'OSS_PUBLIC_BASE_URL': 'https://assets.example.test/certificates',
        **overrides,
    }


def test_save_wraps_local_write_failure_as_storage_write_failed(tmp_path):
    class FailingFileStorage:
        def save(self, _path):
            raise OSError('local storage unavailable')

    error_type = getattr(storage_service, 'StorageWriteFailed', None)
    assert error_type is not None

    with pytest.raises(error_type) as exc_info:
        StorageService(_local_config(tmp_path)).save(FailingFileStorage(), 'upload.png')

    assert isinstance(exc_info.value.__cause__, OSError)


def test_save_wraps_local_upload_directory_creation_failure_as_storage_write_failed(
    monkeypatch, tmp_path
):
    def raise_directory_error(*_args, **_kwargs):
        raise OSError('upload directory is unavailable')

    error_type = getattr(storage_service, 'StorageWriteFailed', None)
    assert error_type is not None
    monkeypatch.setattr(storage_service.os, 'makedirs', raise_directory_error)

    with pytest.raises(error_type) as exc_info:
        StorageService(_local_config(tmp_path)).save(object(), 'upload.png')

    assert isinstance(exc_info.value.__cause__, OSError)


def test_save_wraps_oss_put_failure_as_storage_write_failed(monkeypatch, tmp_path):
    class FailingBucket:
        def put_object(self, _object_key, _stream):
            raise OSError('provider connection unavailable')

    class FileStorage:
        stream = io.BytesIO(b'content')

    error_type = getattr(storage_service, 'StorageWriteFailed', None)
    assert error_type is not None
    monkeypatch.setattr(StorageService, '_oss_bucket', lambda _service: FailingBucket())

    with pytest.raises(error_type) as exc_info:
        StorageService(_oss_config(tmp_path)).save(FileStorage(), 'upload.png')

    assert isinstance(exc_info.value.__cause__, OSError)


def test_read_certificate_image_reads_managed_local_jpeg(tmp_path):
    (tmp_path / 'certificate.jpg').write_bytes(b'jpeg-bytes')
    service = StorageService(_local_config(tmp_path))

    image = service.read_certificate_image('/uploads/certificate.jpg')

    assert image == StoredImage(content=b'jpeg-bytes', mime_type='image/jpeg')


@pytest.mark.parametrize(
    'reference',
    (
        '/uploads/../outside.png',
        '/uploads/nested/certificate.png',
        '/uploads/certificate.png?download=1',
        'https://example.test/uploads/certificate.png',
    ),
)
def test_read_certificate_image_rejects_escaped_local_references(tmp_path, reference):
    (tmp_path / 'certificate.png').write_bytes(b'png-bytes')
    service = StorageService(_local_config(tmp_path))

    with pytest.raises(StorageImageInvalid):
        service.read_certificate_image(reference)


@pytest.mark.parametrize(
    'reference',
    (
        '/uploads/certificate:secret.jpg',
        '/uploads/certificate\x00.jpg',
        '/uploads/certificate\x1f.jpg',
        '/uploads/certificate\x7f.jpg',
    ),
)
def test_local_certificate_reference_validator_rejects_ads_and_controls(reference):
    assert not _is_local_certificate_reference(reference)


def test_read_certificate_image_rejects_unsupported_local_file(tmp_path):
    (tmp_path / 'certificate.gif').write_bytes(b'gif-bytes')
    service = StorageService(_local_config(tmp_path))

    with pytest.raises(StorageImageInvalid):
        service.read_certificate_image('/uploads/certificate.gif')


def test_read_certificate_image_rejects_missing_local_file(tmp_path):
    service = StorageService(_local_config(tmp_path))

    with pytest.raises(StorageImageInvalid):
        service.read_certificate_image('/uploads/missing.webp')


def test_read_certificate_image_rejects_over_limit_local_file(tmp_path):
    (tmp_path / 'certificate.webp').write_bytes(b'12345')
    service = StorageService(_local_config(tmp_path, max_content_length=4))

    with pytest.raises(StorageImageInvalid):
        service.read_certificate_image('/uploads/certificate.webp')


def test_read_certificate_image_reads_oss_object_by_derived_key(monkeypatch, tmp_path):
    class FakeObject:
        def __init__(self):
            self.requested_amounts = []
            self.closed = False

        def read(self, amount=None):
            self.requested_amounts.append(amount)
            return b'webp-bytes'

        def close(self):
            self.closed = True

    class FakeBucket:
        def __init__(self, result):
            self.result = result
            self.requested_keys = []

        def get_object(self, key):
            self.requested_keys.append(key)
            return self.result

    fake_object = FakeObject()
    fake_bucket = FakeBucket(fake_object)
    fake_oss2 = types.SimpleNamespace(
        Auth=lambda *_args: object(),
        Bucket=lambda *_args: fake_bucket,
    )
    monkeypatch.setitem(sys.modules, 'oss2', fake_oss2)
    monkeypatch.setattr(
        socket,
        'create_connection',
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError('network access is forbidden')),
    )
    config = {
        **_local_config(tmp_path),
        'OSS_ENABLED': True,
        'OSS_PROVIDER': 'aliyun',
        'OSS_ACCESS_KEY_ID': 'key-id',
        'OSS_ACCESS_KEY_SECRET': 'key-secret',
        'OSS_BUCKET': 'certificates',
        'OSS_ENDPOINT': 'https://oss.example.test',
        'OSS_PREFIX': 'managed',
        'OSS_PUBLIC_BASE_URL': 'https://assets.example.test/certificates',
    }

    image = StorageService(config).read_certificate_image(
        'https://assets.example.test/certificates/managed/certificate.webp'
    )

    assert image == StoredImage(content=b'webp-bytes', mime_type='image/webp')
    assert fake_bucket.requested_keys == ['managed/certificate.webp']
    assert fake_object.requested_amounts == [1025]
    assert fake_object.closed


def test_read_certificate_image_rejects_over_limit_oss_object_after_bounded_read(
    monkeypatch, tmp_path
):
    class FakeObject:
        def __init__(self):
            self.requested_amounts = []
            self.closed = False

        def read(self, amount=None):
            self.requested_amounts.append(amount)
            return b'12345'

        def close(self):
            self.closed = True

    class FakeBucket:
        def get_object(self, key):
            assert key == 'managed/certificate.png'
            return fake_object

    fake_object = FakeObject()
    monkeypatch.setitem(
        sys.modules,
        'oss2',
        types.SimpleNamespace(Auth=lambda *_args: object(), Bucket=lambda *_args: FakeBucket()),
    )

    with pytest.raises(StorageImageInvalid):
        StorageService(_oss_config(tmp_path, MAX_CONTENT_LENGTH=4)).read_certificate_image(
            'https://assets.example.test/certificates/managed/certificate.png'
        )

    assert fake_object.requested_amounts == [5]
    assert fake_object.closed


def test_read_certificate_image_rejects_empty_oss_object_after_bounded_read(monkeypatch, tmp_path):
    class FakeObject:
        def __init__(self):
            self.requested_amounts = []
            self.closed = False

        def read(self, amount=None):
            self.requested_amounts.append(amount)
            return b''

        def close(self):
            self.closed = True

    class FakeBucket:
        def get_object(self, key):
            assert key == 'managed/certificate.png'
            return fake_object

    fake_object = FakeObject()
    monkeypatch.setitem(
        sys.modules,
        'oss2',
        types.SimpleNamespace(Auth=lambda *_args: object(), Bucket=lambda *_args: FakeBucket()),
    )

    with pytest.raises(StorageImageInvalid):
        StorageService(_oss_config(tmp_path)).read_certificate_image(
            'https://assets.example.test/certificates/managed/certificate.png'
        )

    assert fake_object.requested_amounts == [1025]
    assert fake_object.closed


def test_read_certificate_image_rejects_local_reference_when_oss_is_enabled(monkeypatch, tmp_path):
    class FakeBucket:
        def get_object(self, key):
            raise AssertionError(f'Unexpected object read: {key}')

    (tmp_path / 'certificate.jpg').write_bytes(b'local-jpeg-bytes')
    monkeypatch.setitem(
        sys.modules,
        'oss2',
        types.SimpleNamespace(Auth=lambda *_args: object(), Bucket=lambda *_args: FakeBucket()),
    )

    with pytest.raises(StorageImageInvalid):
        StorageService(_oss_config(tmp_path)).read_certificate_image('/uploads/certificate.jpg')


def test_read_certificate_image_treats_malformed_oss_public_url_config_as_not_configured(
    monkeypatch, tmp_path
):
    monkeypatch.setitem(
        sys.modules,
        'oss2',
        types.SimpleNamespace(Auth=lambda *_args: object(), Bucket=lambda *_args: object()),
    )

    with pytest.raises(StorageNotConfigured):
        StorageService(
            _oss_config(
                tmp_path,
                OSS_ENDPOINT='not-a-url',
            )
        ).read_certificate_image('https://assets.example.test/certificates/managed/certificate.png')


@pytest.mark.parametrize('setup_failure', ('auth', 'bucket'))
def test_read_certificate_image_treats_oss_client_setup_failures_as_not_configured(
    monkeypatch, tmp_path, setup_failure
):
    def raise_setup_error(*_args):
        raise RuntimeError('SDK setup failed')

    fake_oss2 = types.SimpleNamespace(
        Auth=raise_setup_error if setup_failure == 'auth' else lambda *_args: object(),
        Bucket=raise_setup_error if setup_failure == 'bucket' else lambda *_args: object(),
    )
    monkeypatch.setitem(sys.modules, 'oss2', fake_oss2)

    with pytest.raises(StorageNotConfigured):
        StorageService(_oss_config(tmp_path)).read_certificate_image(
            'https://assets.example.test/certificates/managed/certificate.png'
        )


def test_read_certificate_image_wraps_oss_object_read_failure(monkeypatch, tmp_path):
    class FakeObject:
        def read(self, _amount):
            raise OSError('object read failed')

    class FakeBucket:
        def get_object(self, key):
            assert key == 'managed/certificate.png'
            return FakeObject()

    monkeypatch.setitem(
        sys.modules,
        'oss2',
        types.SimpleNamespace(Auth=lambda *_args: object(), Bucket=lambda *_args: FakeBucket()),
    )

    with pytest.raises(StorageReadFailed):
        StorageService(_oss_config(tmp_path)).read_certificate_image(
            'https://assets.example.test/certificates/managed/certificate.png'
        )


@pytest.mark.parametrize(
    'reference',
    (
        'https://assets.example.test/other/certificate.png',
        'https://assets.example.test/certificates/certificate.png?download=1',
        'https://assets.example.test/certificates/certificate.png#preview',
    ),
)
def test_read_certificate_image_rejects_noncanonical_oss_references(monkeypatch, tmp_path, reference):
    class FakeBucket:
        def get_object(self, key):
            raise AssertionError(f'Unexpected object read: {key}')

    monkeypatch.setitem(
        sys.modules,
        'oss2',
        types.SimpleNamespace(Auth=lambda *_args: object(), Bucket=lambda *_args: FakeBucket()),
    )
    config = {
        **_local_config(tmp_path),
        'OSS_ENABLED': True,
        'OSS_PROVIDER': 'aliyun',
        'OSS_ACCESS_KEY_ID': 'key-id',
        'OSS_ACCESS_KEY_SECRET': 'key-secret',
        'OSS_BUCKET': 'certificates',
        'OSS_ENDPOINT': 'https://oss.example.test',
        'OSS_PUBLIC_BASE_URL': 'https://assets.example.test/certificates',
    }

    with pytest.raises(StorageImageInvalid):
        StorageService(config).read_certificate_image(reference)
