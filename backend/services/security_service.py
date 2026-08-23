"""Small security helpers shared by routes."""

import threading
import time
from pathlib import Path


_rate_limit_lock = threading.Lock()
_rate_limit_buckets = {}


def is_rate_limited(scope, key, limit, window_seconds=60):
    """Return True when a key has reached its failure budget."""
    if not limit or limit <= 0:
        return False
    now = time.time()
    bucket_key = (scope, key)
    with _rate_limit_lock:
        bucket = [
            stamp for stamp in _rate_limit_buckets.get(bucket_key, [])
            if now - stamp < window_seconds
        ]
        _rate_limit_buckets[bucket_key] = bucket
        return len(bucket) >= limit


def record_rate_limit_failure(scope, key, window_seconds=60):
    """Record one failed attempt for a scoped key."""
    now = time.time()
    bucket_key = (scope, key)
    with _rate_limit_lock:
        bucket = [
            stamp for stamp in _rate_limit_buckets.get(bucket_key, [])
            if now - stamp < window_seconds
        ]
        bucket.append(now)
        _rate_limit_buckets[bucket_key] = bucket


def clear_rate_limits():
    """Clear in-memory rate limit state for tests and one-off maintenance."""
    with _rate_limit_lock:
        _rate_limit_buckets.clear()


class UploadContentInvalid(ValueError):
    """Raised when uploaded content does not match its declared extension."""


IMAGE_SIGNATURES = {
    "png": (b"\x89PNG\r\n\x1a\n",),
    "jpg": (b"\xff\xd8\xff",),
    "jpeg": (b"\xff\xd8\xff",),
    "gif": (b"GIF87a", b"GIF89a"),
    "webp": (b"RIFF",),
}

DOCUMENT_SIGNATURES = {
    "pdf": (b"%PDF-",),
    "zip": (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),
    "docx": (b"PK\x03\x04",),
    "xlsx": (b"PK\x03\x04",),
    "pptx": (b"PK\x03\x04",),
    "rar": (b"Rar!\x1a\x07\x00", b"Rar!\x1a\x07\x01\x00"),
}

BLOCKED_EXTENSIONS = {"svg", "html", "js"}
TEXT_EXTENSIONS = {"txt", "md", "json", "xml", "csv", "py", "ts", "css", "java", "go", "rs"}
LEGACY_BINARY_EXTENSIONS = {"doc", "xls", "ppt"}
VIDEO_EXTENSIONS = {"mp4", "webm"}


def validate_upload_content(file_storage, filename):
    """Validate upload bytes against extension-level safety rules.

    The function reads a small prefix and restores the stream position before
    returning so storage can save the original upload unchanged.
    """
    ext = Path(filename).suffix.lower().lstrip(".")
    if not ext:
        raise UploadContentInvalid("Missing file extension")
    if ext in BLOCKED_EXTENSIONS:
        raise UploadContentInvalid("Executable browser content is not allowed")

    stream = file_storage.stream
    try:
        original_position = stream.tell()
        prefix = stream.read(512)
        stream.seek(original_position)
    except (OSError, AttributeError) as exc:
        raise UploadContentInvalid("File content could not be inspected") from exc

    if not isinstance(prefix, bytes) or not prefix:
        raise UploadContentInvalid("File is empty")

    if ext == "webp":
        if not (prefix.startswith(b"RIFF") and prefix[8:12] == b"WEBP"):
            raise UploadContentInvalid("Invalid WEBP signature")
        return

    signatures = IMAGE_SIGNATURES.get(ext) or DOCUMENT_SIGNATURES.get(ext)
    if signatures:
        if not any(prefix.startswith(signature) for signature in signatures):
            raise UploadContentInvalid("File signature does not match extension")
        return

    if ext in TEXT_EXTENSIONS:
        _validate_text_prefix(prefix)
        return

    if ext in LEGACY_BINARY_EXTENSIONS or ext in VIDEO_EXTENSIONS:
        return

    raise UploadContentInvalid("Unsupported file content")


def _validate_text_prefix(prefix):
    if b"\x00" in prefix:
        raise UploadContentInvalid("Text file contains binary bytes")
    try:
        prefix.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise UploadContentInvalid("Text file must be UTF-8") from exc
