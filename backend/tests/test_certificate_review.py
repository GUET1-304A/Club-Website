"""证书智能识别 → 管理端审核 → 成果库归档 闭环测试。

覆盖：
  - 管理端证书列表/详情
  - 审核通过：证书转 verified + 自动生成 Award（幂等）+ 站内通知
  - 审核驳回：证书转 rejected + 通知，不生成 Award
  - 权限：成员 token 不可审核
  - 成员修正被驳回证书后自动重新送审
  - 未建证书直接对图片 AI 识别并返回结构化字段
"""

import base64

from models import Award, Certificate, Notification, db
from services.storage_service import StoredImage


_MINIMAL_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl3MioAAAAASUVORK5CYII="
)


def _member_headers(client, account="2023001"):
    login = client.post(
        "/api/member/login",
        json={"account": account, "password": "member123"},
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.get_json()['token']}"}


def _admin_headers(client):
    login = client.post(
        "/api/admin/login",
        json={"username": "admin", "password": "admin123"},
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.get_json()['token']}"}


def _create_certificate(client, headers, name="蓝桥杯省赛一等奖", **overrides):
    payload = {
        "name": name,
        "level": "provincial",
        "category": "程序设计",
        "winner": "测试成员",
        "issuer": "中国软件行业协会",
        "date": "2025-04",
        "images": ["/uploads/cert.png"],
        **overrides,
    }
    created = client.post("/api/member/certificates", headers=headers, json=payload)
    assert created.status_code == 201
    return created.get_json()["certificate"]["id"]


def _cleanup_review_artifacts(client, certificate_ids):
    with client.application.app_context():
        for certificate_id in certificate_ids:
            award = Award.query.filter_by(certificate_id=certificate_id).first()
            if award is not None:
                db.session.delete(award)
            certificate = db.session.get(Certificate, certificate_id)
            if certificate is not None:
                db.session.delete(certificate)
        Notification.query.filter(
            Notification.title.in_(("证书已认证", "证书被驳回"))
        ).delete(synchronize_session=False)
        db.session.commit()


def test_admin_certificate_approval_archives_award_and_notifies(client):
    headers = _member_headers(client)
    admin_headers = _admin_headers(client)
    certificate_id = _create_certificate(client, headers)

    try:
        reviewed = client.post(
            f"/api/admin/certificates/{certificate_id}/review",
            headers=admin_headers,
            json={"status": "verified", "reviewNote": "材料齐全，同意归档"},
        )
        assert reviewed.status_code == 200
        data = reviewed.get_json()
        assert data["certificate"]["status"] == "verified"
        assert data["certificate"]["reviewNote"] == "材料齐全，同意归档"
        assert data["certificate"]["reviewedAt"] is not None

        award = data["award"]
        assert award is not None
        assert award["name"] == "蓝桥杯省赛一等奖"
        assert award["level"] == "provincial"
        assert award["winner"] == "测试成员"
        assert award["issuer"] == "中国软件行业协会"
        assert award["date"] == "2025-04"
        assert award["certificateImages"] == ["/uploads/cert.png"]
        assert award["certificateId"] == certificate_id

        with client.application.app_context():
            stored = Award.query.filter_by(certificate_id=certificate_id).first()
            assert stored is not None
            assert stored.slug == f"cert-{certificate_id}"

        notifications = client.get("/api/member/notifications", headers=headers).get_json()
        assert any(
            n["type"] == "announcement"
            and n["title"] == "证书已认证"
            and "归档至实验室成果库" in n["body"]
            for n in notifications
        )

        listed = client.get(
            "/api/admin/certificates?status=verified", headers=admin_headers
        ).get_json()
        assert any(c["id"] == certificate_id for c in listed)

        detail = client.get(
            f"/api/admin/certificates/{certificate_id}", headers=admin_headers
        ).get_json()
        assert detail["status"] == "verified"
    finally:
        _cleanup_review_artifacts(client, [certificate_id])


def test_admin_certificate_approval_is_idempotent(client):
    headers = _member_headers(client)
    admin_headers = _admin_headers(client)
    certificate_id = _create_certificate(client, headers)

    try:
        for _ in range(2):
            response = client.post(
                f"/api/admin/certificates/{certificate_id}/review",
                headers=admin_headers,
                json={"status": "verified"},
            )
            assert response.status_code == 200
        with client.application.app_context():
            assert Award.query.filter_by(certificate_id=certificate_id).count() == 1
    finally:
        _cleanup_review_artifacts(client, [certificate_id])


def test_admin_certificate_rejection_does_not_archive(client):
    headers = _member_headers(client)
    admin_headers = _admin_headers(client)
    certificate_id = _create_certificate(client, headers)

    try:
        reviewed = client.post(
            f"/api/admin/certificates/{certificate_id}/review",
            headers=admin_headers,
            json={"status": "rejected", "reviewNote": "证书图片不清晰"},
        )
        assert reviewed.status_code == 200
        data = reviewed.get_json()
        assert data["certificate"]["status"] == "rejected"
        assert data["certificate"]["reviewNote"] == "证书图片不清晰"
        assert data["award"] is None

        with client.application.app_context():
            assert Award.query.filter_by(certificate_id=certificate_id).first() is None

        notifications = client.get("/api/member/notifications", headers=headers).get_json()
        assert any(
            n["title"] == "证书被驳回" and "不清晰" in n["body"]
            for n in notifications
        )
    finally:
        _cleanup_review_artifacts(client, [certificate_id])


def test_certificate_review_requires_admin_token(client):
    headers = _member_headers(client)
    certificate_id = _create_certificate(client, headers)

    try:
        response = client.post(
            f"/api/admin/certificates/{certificate_id}/review",
            headers=headers,
            json={"status": "verified"},
        )
        assert response.status_code == 403
        response = client.post(
            f"/api/admin/certificates/{certificate_id}/review",
            json={"status": "verified"},
        )
        assert response.status_code == 401
    finally:
        _cleanup_review_artifacts(client, [certificate_id])


def test_certificate_review_validates_status(client):
    admin_headers = _admin_headers(client)
    response = client.post(
        "/api/admin/certificates/1/review",
        headers=admin_headers,
        json={"status": "maybe"},
    )
    assert response.status_code == 400


def test_member_edit_rejected_certificate_resubmits_for_review(client):
    headers = _member_headers(client)
    admin_headers = _admin_headers(client)
    certificate_id = _create_certificate(client, headers)

    try:
        client.post(
            f"/api/admin/certificates/{certificate_id}/review",
            headers=admin_headers,
            json={"status": "rejected", "reviewNote": "请补充获奖人"},
        )
        updated = client.put(
            f"/api/member/certificates/{certificate_id}",
            headers=headers,
            json={"winner": "张三、李四", "name": "蓝桥杯省赛一等奖（修正）"},
        )
        assert updated.status_code == 200
        assert updated.get_json()["certificate"]["status"] == "pending"
        assert updated.get_json()["certificate"]["name"] == "蓝桥杯省赛一等奖（修正）"
    finally:
        _cleanup_review_artifacts(client, [certificate_id])


def test_member_ocr_images_endpoint_returns_fields_without_persisting(client, monkeypatch, tmp_path):
    for key, value in {
        "OCR_ENABLED": True,
        "OCR_API_KEY": "test-key",
        "OCR_ENDPOINT": "https://ocr.example.test/v1",
        "OCR_MODEL": "vision-test",
        "OSS_ENABLED": False,
        "UPLOAD_FOLDER": str(tmp_path),
    }.items():
        monkeypatch.setitem(client.application.config, key, value)
    monkeypatch.delitem(client.application.config, "PUBLIC_BASE_URL", raising=False)
    (tmp_path / "cert.png").write_bytes(_MINIMAL_PNG)

    headers = _member_headers(client)
    received_images = []

    def fake_extract_fields(_service, images):
        received_images.extend(images)
        return {
            "ocr_text": "荣誉证书\n张三 同学",
            "fields": {
                "name": "蓝桥杯省赛一等奖",
                "level": "provincial",
                "category": "程序设计",
                "winner": "张三",
                "issuer": "中国软件行业协会",
                "date": "2025-04",
                "description": "",
            },
        }

    monkeypatch.setattr(
        "services.ocr_service.OcrService.extract_fields",
        fake_extract_fields,
    )

    response = client.post(
        "/api/member/certificates/ocr",
        headers=headers,
        json={"images": ["/uploads/cert.png"]},
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["ocrText"] == "荣誉证书\n张三 同学"
    assert data["ocrFields"]["name"] == "蓝桥杯省赛一等奖"
    assert data["ocrFields"]["level"] == "provincial"
    assert received_images == [StoredImage(content=_MINIMAL_PNG, mime_type="image/png")]
    with client.application.app_context():
        persisted = Certificate.query.filter(
            Certificate.ocr_text == "荣誉证书\n张三 同学"
        ).first()
        assert persisted is None


def test_member_ocr_images_endpoint_requires_auth(client):
    response = client.post(
        "/api/member/certificates/ocr",
        json={"images": ["/uploads/cert.png"]},
    )
    assert response.status_code == 401


def test_member_ocr_images_endpoint_rejects_more_than_five_images(client):
    client.application.config.update({
        "OCR_ENABLED": True,
        "OCR_API_KEY": "test-key",
        "OCR_ENDPOINT": "https://ocr.example.test/v1",
        "OCR_MODEL": "vision-test",
    })
    headers = _member_headers(client)
    response = client.post(
        "/api/member/certificates/ocr",
        headers=headers,
        json={"images": [f"/uploads/cert-{i}.png" for i in range(6)]},
    )
    assert response.status_code == 422
    assert response.get_json()["message"] == "Certificate OCR accepts at most 5 images."
