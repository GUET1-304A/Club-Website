# Certificate OCR Managed Bytes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send only backend-read certificate image bytes to the configured OCR provider.

**Architecture:** `StorageService` resolves a stored certificate reference to a bounded image byte object without network access to that reference. `OcrService` encodes that object as a base64 Data URL. The member route composes both services after member/ownership/configuration checks and maps storage failure to safe JSON responses.

**Tech Stack:** Flask, SQLAlchemy, Python standard library, Aliyun OSS SDK, pytest, React.

---

### Task 1: Add managed certificate image reads

**Files:**

- Modify: `backend/services/storage_service.py`
- Create: `backend/tests/test_storage_service.py`

- [ ] **Step 1: Write the failing local-read and rejection tests**

```python
def test_read_certificate_image_reads_a_local_upload(tmp_path):
    uploads = tmp_path / 'uploads'
    uploads.mkdir()
    (uploads / 'cert.png').write_bytes(b'png-bytes')
    service = StorageService({'UPLOAD_FOLDER': str(uploads), 'MAX_CONTENT_LENGTH': 16, 'OSS_ENABLED': False})

    image = service.read_certificate_image('/uploads/cert.png')

    assert image.mime_type == 'image/png'
    assert image.content == b'png-bytes'


def test_read_certificate_image_rejects_unmanaged_reference(tmp_path):
    service = StorageService({'UPLOAD_FOLDER': str(tmp_path), 'MAX_CONTENT_LENGTH': 16, 'OSS_ENABLED': False})

    with pytest.raises(StorageImageInvalid):
        service.read_certificate_image('https://example.test/cert.png')
```

- [ ] **Step 2: Verify red**

Run `py -m pytest -q tests/test_storage_service.py`. Expected: fail because the new service API does not exist.

- [ ] **Step 3: Implement bounded reads**

```python
@dataclass(frozen=True)
class StoredImage:
    content: bytes
    mime_type: str


class StorageImageInvalid(ValueError):
    pass


class StorageReadFailed(RuntimeError):
    pass


def read_certificate_image(self, reference):
    if _is_local_certificate_reference(reference):
        return self._read_local_certificate_image(reference)
    if self.config.get('OSS_ENABLED', False):
        return self._read_oss_certificate_image(reference)
    raise StorageImageInvalid('Certificate image is not a managed upload')
```

Resolve local references to one basename inside `UPLOAD_FOLDER`; reject escape paths, unsupported extensions, missing files, and `MAX_CONTENT_LENGTH + 1` reads. Permit only JPEG, PNG, and WebP. The OSS reader matches only the service-generated `_oss_public_url(config, '')` prefix, validates object-key segments, reads through configured bucket credentials, applies identical size/MIME limits, and never opens `reference` as a URL.

- [ ] **Step 4: Verify green and commit**

Run `py -m pytest -q tests/test_storage_service.py`; expected PASS. Commit only `backend/services/storage_service.py` and `backend/tests/test_storage_service.py` with message `feat: read managed certificate images from storage`.

### Task 2: Convert managed bytes to OCR Data URLs

**Files:**

- Modify: `backend/services/ocr_service.py`
- Create: `backend/tests/test_ocr_service.py`

- [ ] **Step 1: Write the failing request-payload test**

```python
def test_extract_text_sends_managed_image_as_data_url():
    captured = {}
    service = OcrService(ocr_config(), opener=capturing_opener(captured, 'Certificate text'))

    result = service.extract_text([StoredImage(content=b'png-bytes', mime_type='image/png')])

    assert result == 'Certificate text'
    assert captured['messages'][0]['content'][1]['image_url']['url'] == 'data:image/png;base64,cG5nLWJ5dGVz'
```

- [ ] **Step 2: Verify red**

Run `py -m pytest -q tests/test_ocr_service.py`. Expected: fail because `extract_text` currently consumes URL strings.

- [ ] **Step 3: Implement byte serialization**

```python
import base64

def _image_content(image):
    if image.mime_type not in {'image/jpeg', 'image/png', 'image/webp'} or not image.content:
        raise OcrRequestFailed('Certificate image is unavailable')
    encoded = base64.b64encode(image.content).decode('ascii')
    return {'type': 'image_url', 'image_url': {'url': f'data:{image.mime_type};base64,{encoded}'}}
```

Make `extract_text(images)` append `_image_content(image)`. Add a public configuration check used by the route; preserve the existing timeout and response parser. Raw URL strings are not valid images.

- [ ] **Step 4: Verify green and commit**

Run `py -m pytest -q tests/test_ocr_service.py`; expected PASS. Commit only `backend/services/ocr_service.py` and `backend/tests/test_ocr_service.py` with message `feat: send managed OCR image bytes as data URLs`.

### Task 3: Route OCR through managed bytes

**Files:**

- Modify: `backend/routes/member.py` only in OCR imports, endpoint, and OCR-only helpers
- Modify: `backend/tests/test_business_integrations.py`

- [ ] **Step 1: Write a failing route integration test**

```python
def test_certificate_ocr_passes_managed_bytes_without_public_url(client, monkeypatch, tmp_path):
    client.application.config.update(OCR_ENABLED=True, OCR_API_KEY='key', OCR_ENDPOINT='https://ocr.example.test/v1', OCR_MODEL='vision', UPLOAD_FOLDER=str(tmp_path))
    (tmp_path / 'cert.png').write_bytes(b'png-bytes')
    captured = []
    monkeypatch.setattr('services.ocr_service.OcrService.extract_text', lambda _service, images: captured.extend(images) or 'text')
    certificate_id = create_certificate(client, images=['/uploads/cert.png'])

    response = client.post(f'/api/member/certificates/{certificate_id}/ocr', headers=_member_headers(client))

    assert response.status_code == 200
    assert captured[0].content == b'png-bytes'
    assert captured[0].mime_type == 'image/png'
```

Also test an untrusted persisted `https://127.0.0.1/private.png` is `422 invalid_certificate_images` and does not call OCR.

- [ ] **Step 2: Verify red**

Run `py -m pytest -q tests/test_business_integrations.py`. Expected: fail because the route forwards strings and depends on public URL configuration.

- [ ] **Step 3: Implement composition and safe errors**

```python
ocr_service = OcrService(current_app.config)
try:
    ocr_service.validate_configuration()
    images = [StorageService(current_app.config).read_certificate_image(ref) for ref in (cert.images or [])]
    text = ocr_service.extract_text(images)
except StorageImageInvalid:
    return jsonify({'error': 'invalid_certificate_images', 'message': 'Certificate images must be managed image uploads.'}), 422
except StorageNotConfigured:
    return jsonify({'error': 'not_configured', 'message': 'Object storage is not configured.'}), 503
except StorageReadFailed:
    return jsonify({'error': 'ocr_failed', 'message': 'Certificate image could not be read. Please try again later.'}), 502
except OcrNotConfigured:
    return jsonify({'error': 'not_configured', 'message': 'OCR is not configured. Ask an administrator to configure the OCR provider.'}), 503
except OcrRequestFailed:
    return jsonify({'error': 'ocr_failed', 'message': 'Certificate recognition is temporarily unavailable. Please try again later.'}), 502
```

Delete the old URL/DNS/public-host helper chain because no provider-facing URL resolution or request Host processing remains. Preserve all unrelated route modifications.

- [ ] **Step 4: Verify green**

Run `py -m pytest -q tests/test_business_integrations.py`; expected PASS with local byte use, untrusted rejection, persistence, and safe errors.

### Task 4: Verify and safely commit delivery

**Files:**

- Verify: `backend/tests/test_storage_service.py`, `backend/tests/test_ocr_service.py`, `backend/tests/test_business_integrations.py`
- Verify: `frontendnew/src/services/memberApi.ts`, `frontendnew/src/components/member/CertificateManager.tsx`

- [ ] **Step 1: Execute full verification**

Run `py -m pytest -q`, `npm run check`, and `npm run build`. Expected: all commands exit `0`; report pre-existing warnings separately.

- [ ] **Step 2: Inspect staging boundaries**

Run `git diff --check`, `git status --short`, and `git diff -U0 -- backend/routes/member.py backend/config.py`. Never stage either dirty route/config file wholesale.

- [ ] **Step 3: Commit reviewed OCR route hunks**

Apply a reviewed exact patch to the Git index containing only OCR imports, endpoint, and OCR-helper replacement; stage the OCR integration tests; run `git diff --cached --check`; commit with `feat: secure certificate OCR byte transport`. Exclude unrelated route documentation, tasks, resources, certificate CRUD, storage upload, and all config hunks.
