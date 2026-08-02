import base64
import io

import pytest

from models import Certificate, db
from services.ocr_service import OcrRequestFailed
from services import storage_service
from services.storage_service import StorageNotConfigured, StorageReadFailed, StoredImage


_MINIMAL_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl3MioAAAAASUVORK5CYII="
)
_MINIMAL_PNG_WITH_COMMENT = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl3MioAAAALdEVYdENvbW1lbnQAdHdvagGQugAAAABJRU5ErkJggg=="
)


def _member_headers(client):
    login = client.post(
        "/api/member/login",
        json={"account": "2023002", "password": "member123"},
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.get_json()['token']}"}


def _storage_write_failed_type():
    error_type = getattr(storage_service, 'StorageWriteFailed', None)
    assert error_type is not None
    return error_type


def _raise_storage_write_failure(error_type):
    def raise_failure(*_args, **_kwargs):
        raise error_type('provider details must not reach the member')

    return raise_failure


def test_member_resource_upload_maps_storage_write_failure_to_safe_response(client, monkeypatch):
    error_type = _storage_write_failed_type()
    monkeypatch.setattr(
        'services.storage_service.StorageService.save',
        _raise_storage_write_failure(error_type),
    )

    response = client.post(
        '/api/member/resources/upload',
        headers=_member_headers(client),
        data={'file': (io.BytesIO(b'resource data'), 'resource.png')},
    )

    assert response.status_code == 502
    assert response.get_json() == {
        'error': 'storage_failed',
        'message': 'File could not be stored. Please try again later.',
    }


def test_member_certificate_upload_maps_storage_write_failure_to_safe_response(client, monkeypatch):
    error_type = _storage_write_failed_type()
    monkeypatch.setattr(
        'services.storage_service.StorageService.save',
        _raise_storage_write_failure(error_type),
    )

    response = client.post(
        '/api/member/certificates/upload',
        headers=_member_headers(client),
        data={'file': (io.BytesIO(_MINIMAL_PNG), 'certificate.png')},
    )

    assert response.status_code == 502
    assert response.get_json() == {
        'error': 'storage_failed',
        'message': 'File could not be stored. Please try again later.',
    }


def test_upload_returns_not_configured_when_oss_is_explicitly_incomplete(client):
    login = client.post(
        "/api/admin/login",
        json={"username": "admin", "password": "admin123"},
    )
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.get_json()['token']}"}
    client.application.config.update(
        OSS_ENABLED=True,
        OSS_PROVIDER="aliyun",
        OSS_ACCESS_KEY_ID="",
        OSS_ACCESS_KEY_SECRET="",
        OSS_BUCKET="",
        OSS_ENDPOINT="",
    )

    response = client.post(
        "/api/admin/upload",
        headers=headers,
        data={"file": (io.BytesIO(b"storage test"), "integration.png")},
    )

    assert response.status_code == 503
    assert response.get_json()["error"] == "not_configured"


def _configure_local_ocr(client, monkeypatch, upload_folder):
    config = client.application.config
    for key, value in {
        "OCR_ENABLED": True,
        "OCR_API_KEY": "test-key",
        "OCR_ENDPOINT": "https://ocr.example.test/v1",
        "OCR_MODEL": "vision-test",
        "OSS_ENABLED": False,
        "UPLOAD_FOLDER": str(upload_folder),
    }.items():
        monkeypatch.setitem(config, key, value)
    monkeypatch.delitem(config, "PUBLIC_BASE_URL", raising=False)


def _create_certificate(client, headers, name, images):
    created = client.post(
        "/api/member/certificates",
        headers=headers,
        json={"name": name, "images": images},
    )
    assert created.status_code == 201
    return created.get_json()["certificate"]["id"]


def _create_ocr_authorization_certificate(client):
    owner_headers = _member_headers(client)
    certificate_id = _create_certificate(
        client,
        owner_headers,
        'OCR authorization boundary test',
        ['/uploads/certificate.png'],
    )
    with client.application.app_context():
        certificate = db.session.get(Certificate, certificate_id)
        certificate.ocr_text = 'existing OCR text must remain unchanged'
        db.session.commit()
    return owner_headers, certificate_id


def _forbid_ocr_dependencies(monkeypatch):
    storage_calls = []
    ocr_calls = []

    def read_certificate_image(*args, **kwargs):
        storage_calls.append((args, kwargs))
        raise AssertionError('storage must not be read before authorization succeeds')

    def extract_text(*args, **kwargs):
        ocr_calls.append((args, kwargs))
        raise AssertionError('OCR provider must not be called before authorization succeeds')

    monkeypatch.setattr(
        'services.storage_service.StorageService.read_certificate_image',
        read_certificate_image,
    )
    monkeypatch.setattr('services.ocr_service.OcrService.extract_text', extract_text)
    return storage_calls, ocr_calls


def _assert_ocr_authorization_rejection_preserves_certificate(
    client, certificate_id, response, storage_calls, ocr_calls, expected_status
):
    assert response.status_code == expected_status
    assert storage_calls == []
    assert ocr_calls == []
    with client.application.app_context():
        db.session.expire_all()
        certificate = db.session.get(Certificate, certificate_id)
        assert certificate.ocr_text == 'existing OCR text must remain unchanged'


def test_certificate_ocr_requires_authorization_before_storage_or_provider(client, monkeypatch):
    owner_headers, certificate_id = _create_ocr_authorization_certificate(client)
    storage_calls, ocr_calls = _forbid_ocr_dependencies(monkeypatch)

    try:
        response = client.post(f'/api/member/certificates/{certificate_id}/ocr')
        _assert_ocr_authorization_rejection_preserves_certificate(
            client, certificate_id, response, storage_calls, ocr_calls, 401
        )
    finally:
        client.delete(f'/api/member/certificates/{certificate_id}', headers=owner_headers)


def test_certificate_ocr_rejects_admin_token_before_storage_or_provider(client, monkeypatch):
    owner_headers, certificate_id = _create_ocr_authorization_certificate(client)
    storage_calls, ocr_calls = _forbid_ocr_dependencies(monkeypatch)
    admin_login = client.post(
        '/api/admin/login',
        json={'username': 'admin', 'password': 'admin123'},
    )
    assert admin_login.status_code == 200
    admin_headers = {'Authorization': f"Bearer {admin_login.get_json()['token']}"}

    try:
        response = client.post(
            f'/api/member/certificates/{certificate_id}/ocr',
            headers=admin_headers,
        )
        _assert_ocr_authorization_rejection_preserves_certificate(
            client, certificate_id, response, storage_calls, ocr_calls, 403
        )
    finally:
        client.delete(f'/api/member/certificates/{certificate_id}', headers=owner_headers)


def test_certificate_ocr_hides_other_members_certificate_before_storage_or_provider(
    client, monkeypatch
):
    owner_headers, certificate_id = _create_ocr_authorization_certificate(client)
    storage_calls, ocr_calls = _forbid_ocr_dependencies(monkeypatch)
    other_login = client.post(
        '/api/member/login',
        json={'account': '2023001', 'password': 'member123'},
    )
    assert other_login.status_code == 200
    other_headers = {'Authorization': f"Bearer {other_login.get_json()['token']}"}

    try:
        response = client.post(
            f'/api/member/certificates/{certificate_id}/ocr',
            headers=other_headers,
        )
        _assert_ocr_authorization_rejection_preserves_certificate(
            client, certificate_id, response, storage_calls, ocr_calls, 404
        )
    finally:
        client.delete(f'/api/member/certificates/{certificate_id}', headers=owner_headers)


def test_certificate_ocr_reads_local_managed_image_without_public_base_url(
    client, monkeypatch, tmp_path
):
    _configure_local_ocr(client, monkeypatch, tmp_path)
    (tmp_path / "cert.png").write_bytes(_MINIMAL_PNG)
    headers = _member_headers(client)
    certificate_id = _create_certificate(
        client, headers, "OCR managed image test", ["/uploads/cert.png"]
    )
    received_images = []
    monkeypatch.setattr(
        "services.ocr_service.OcrService.extract_text",
        lambda _service, images: received_images.extend(images) or "Managed OCR text",
    )

    try:
        response = client.post(
            f"/api/member/certificates/{certificate_id}/ocr", headers=headers
        )
        assert response.status_code == 200
        assert response.get_json()["ocrText"] == "Managed OCR text"
        assert received_images == [StoredImage(content=_MINIMAL_PNG, mime_type="image/png")]
    finally:
        client.delete(f"/api/member/certificates/{certificate_id}", headers=headers)


def test_certificate_ocr_passes_managed_images_to_provider_in_reference_order(
    client, monkeypatch, tmp_path
):
    _configure_local_ocr(client, monkeypatch, tmp_path)
    (tmp_path / "cert-one.png").write_bytes(_MINIMAL_PNG)
    (tmp_path / "cert-two.png").write_bytes(_MINIMAL_PNG_WITH_COMMENT)
    headers = _member_headers(client)
    certificate_id = _create_certificate(
        client,
        headers,
        "OCR managed image order test",
        ["/uploads/cert-one.png", "/uploads/cert-two.png"],
    )
    received_images = []
    monkeypatch.setattr(
        "services.ocr_service.OcrService.extract_text",
        lambda _service, images: received_images.extend(images) or "Managed OCR text",
    )

    try:
        response = client.post(
            f"/api/member/certificates/{certificate_id}/ocr", headers=headers
        )
        assert response.status_code == 200
        assert received_images == [
            StoredImage(content=_MINIMAL_PNG, mime_type="image/png"),
            StoredImage(content=_MINIMAL_PNG_WITH_COMMENT, mime_type="image/png"),
        ]
    finally:
        client.delete(f"/api/member/certificates/{certificate_id}", headers=headers)


def test_certificate_ocr_rejects_more_than_five_images_before_storage_or_provider(
    client, monkeypatch, tmp_path
):
    _configure_local_ocr(client, monkeypatch, tmp_path)
    headers = _member_headers(client)
    certificate_id = _create_certificate(
        client,
        headers,
        "OCR image count limit test",
        [f"/uploads/cert-{index}.png" for index in range(6)],
    )
    monkeypatch.setattr(
        "services.storage_service.StorageService.read_certificate_image",
        lambda *_args: (_ for _ in ()).throw(AssertionError("storage must not be read")),
    )
    monkeypatch.setattr(
        "services.ocr_service.OcrService.extract_text",
        lambda *_args: (_ for _ in ()).throw(AssertionError("provider must not be called")),
    )

    try:
        response = client.post(
            f"/api/member/certificates/{certificate_id}/ocr", headers=headers
        )
        assert response.status_code == 422
        assert response.get_json() == {
            "error": "invalid_certificate_images",
            "message": "Certificate OCR accepts at most 5 images.",
        }
    finally:
        client.delete(f"/api/member/certificates/{certificate_id}", headers=headers)


def test_certificate_ocr_rejects_images_exceeding_aggregate_byte_budget(
    client, monkeypatch, tmp_path
):
    _configure_local_ocr(client, monkeypatch, tmp_path)
    (tmp_path / "cert-one.png").write_bytes(_MINIMAL_PNG)
    (tmp_path / "cert-two.png").write_bytes(_MINIMAL_PNG)
    headers = _member_headers(client)
    certificate_id = _create_certificate(
        client,
        headers,
        "OCR aggregate image limit test",
        ["/uploads/cert-one.png", "/uploads/cert-two.png"],
    )
    monkeypatch.setitem(client.application.config, "MAX_CONTENT_LENGTH", len(_MINIMAL_PNG))
    monkeypatch.setattr(
        "services.ocr_service.OcrService.extract_text",
        lambda *_args: (_ for _ in ()).throw(AssertionError("provider must not be called")),
    )

    try:
        response = client.post(
            f"/api/member/certificates/{certificate_id}/ocr", headers=headers
        )
        assert response.status_code == 413
        assert response.get_json() == {
            "error": "certificate_images_too_large",
            "message": "Certificate images exceed the total size limit.",
        }
    finally:
        client.delete(f"/api/member/certificates/{certificate_id}", headers=headers)


@pytest.mark.parametrize("images", ([], 1, True))
def test_certificate_ocr_rejects_empty_or_scalar_images_before_storage_or_provider(
    client, monkeypatch, tmp_path, images
):
    _configure_local_ocr(client, monkeypatch, tmp_path)
    headers = _member_headers(client)
    certificate_id = _create_certificate(
        client, headers, "OCR malformed image references test", images
    )
    monkeypatch.setattr(
        "services.storage_service.StorageService.read_certificate_image",
        lambda *_args: (_ for _ in ()).throw(AssertionError("storage must not be read")),
    )
    monkeypatch.setattr(
        "services.ocr_service.OcrService.extract_text",
        lambda *_args: (_ for _ in ()).throw(AssertionError("provider must not be called")),
    )

    try:
        response = client.post(
            f"/api/member/certificates/{certificate_id}/ocr", headers=headers
        )
        assert response.status_code == 422
        assert response.get_json() == {
            "error": "invalid_certificate_images",
            "message": "Certificate images must be managed image uploads.",
        }
    finally:
        client.delete(f"/api/member/certificates/{certificate_id}", headers=headers)


def test_certificate_ocr_returns_not_configured_without_ocr_settings(
    client, monkeypatch, tmp_path
):
    _configure_local_ocr(client, monkeypatch, tmp_path)
    monkeypatch.setitem(client.application.config, "OCR_ENABLED", False)
    headers = _member_headers(client)
    certificate_id = _create_certificate(
        client, headers, "OCR configuration test", ["/uploads/cert.png"]
    )

    try:
        response = client.post(
            f"/api/member/certificates/{certificate_id}/ocr", headers=headers
        )
        assert response.status_code == 503
        assert response.get_json() == {
            "error": "not_configured",
            "message": "OCR is not configured. Ask an administrator to configure the OCR provider.",
        }
    finally:
        client.delete(f"/api/member/certificates/{certificate_id}", headers=headers)


def test_certificate_ocr_rejects_external_image_without_local_read_or_provider_call(
    client, monkeypatch, tmp_path
):
    _configure_local_ocr(client, monkeypatch, tmp_path)
    headers = _member_headers(client)
    certificate_id = _create_certificate(
        client, headers, "OCR external image test", ["https://127.0.0.1/private.png"]
    )
    monkeypatch.setattr(
        "services.storage_service.StorageService._read_local_certificate_image",
        lambda *_args: (_ for _ in ()).throw(AssertionError("managed storage must not be read")),
    )
    monkeypatch.setattr(
        "services.ocr_service.OcrService.extract_text",
        lambda *_args: (_ for _ in ()).throw(AssertionError("provider must not be called")),
    )

    try:
        response = client.post(
            f"/api/member/certificates/{certificate_id}/ocr", headers=headers
        )
        assert response.status_code == 422
        assert response.get_json()["error"] == "invalid_certificate_images"
    finally:
        client.delete(f"/api/member/certificates/{certificate_id}", headers=headers)


@pytest.mark.parametrize(
    ("storage_error", "status", "body"),
    (
        (
            StorageNotConfigured(),
            503,
            {"error": "not_configured", "message": "Object storage is not configured."},
        ),
        (
            StorageReadFailed("storage details"),
            502,
            {
                "error": "ocr_failed",
                "message": "Certificate image could not be read. Please try again later.",
            },
        ),
    ),
)
def test_certificate_ocr_maps_managed_storage_failures(
    client, monkeypatch, tmp_path, storage_error, status, body
):
    _configure_local_ocr(client, monkeypatch, tmp_path)
    headers = _member_headers(client)
    certificate_id = _create_certificate(
        client, headers, "OCR storage failure test", ["/uploads/cert.png"]
    )
    monkeypatch.setattr(
        "services.storage_service.StorageService.read_certificate_image",
        lambda *_args: (_ for _ in ()).throw(storage_error),
    )
    monkeypatch.setattr(
        "services.ocr_service.OcrService.extract_text",
        lambda *_args: (_ for _ in ()).throw(AssertionError("provider must not be called")),
    )

    try:
        response = client.post(
            f"/api/member/certificates/{certificate_id}/ocr", headers=headers
        )
        assert response.status_code == status
        assert response.get_json() == body
    finally:
        client.delete(f"/api/member/certificates/{certificate_id}", headers=headers)


def test_certificate_ocr_returns_safe_failure_message(client, monkeypatch, tmp_path):
    _configure_local_ocr(client, monkeypatch, tmp_path)
    (tmp_path / "cert.png").write_bytes(b"png-bytes")
    headers = _member_headers(client)
    certificate_id = _create_certificate(
        client, headers, "OCR failure test", ["/uploads/cert.png"]
    )
    monkeypatch.setattr(
        "services.ocr_service.OcrService.extract_text",
        lambda *_args: (_ for _ in ()).throw(OcrRequestFailed("provider details")),
    )

    try:
        response = client.post(
            f"/api/member/certificates/{certificate_id}/ocr", headers=headers
        )
        body = response.get_json()
        assert response.status_code == 502
        assert body == {
            "error": "ocr_failed",
            "message": "Certificate recognition is temporarily unavailable. Please try again later.",
        }
        assert "provider details" not in body["message"]
    finally:
        client.delete(f"/api/member/certificates/{certificate_id}", headers=headers)


def test_certificate_ocr_persists_provider_text(client, monkeypatch, tmp_path):
    _configure_local_ocr(client, monkeypatch, tmp_path)
    (tmp_path / "cert.png").write_bytes(b"png-bytes")
    headers = _member_headers(client)
    certificate_id = _create_certificate(
        client, headers, "OCR persistence test", ["/uploads/cert.png"]
    )
    monkeypatch.setattr(
        "services.ocr_service.OcrService.extract_text",
        lambda _service, _images: "Provider supplied certificate text",
    )

    try:
        response = client.post(
            f"/api/member/certificates/{certificate_id}/ocr", headers=headers
        )
        assert response.status_code == 200
        assert response.get_json()["ocrText"] == "Provider supplied certificate text"
        with client.application.app_context():
            assert db.session.get(Certificate, certificate_id).ocr_text == "Provider supplied certificate text"
    finally:
        client.delete(f"/api/member/certificates/{certificate_id}", headers=headers)
