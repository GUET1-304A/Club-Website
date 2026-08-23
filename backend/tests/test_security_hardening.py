from io import BytesIO


def test_default_development_admin_login_includes_password_change_warning(client):
    response = client.post(
        "/api/admin/login",
        json={"username": "admin", "password": "admin123"},
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["user"]["mustChangePassword"] is True
    assert data["user"]["securityWarnings"] == [
        "默认管理员密码仍在使用，请立即在权限管理中修改。"
    ]


def test_admin_login_rate_limits_repeated_failures_from_same_ip(client, monkeypatch):
    monkeypatch.setitem(client.application.config, "LOGIN_RATE_LIMIT_PER_MINUTE", 2)
    remote_addr = "203.0.113.24"

    first = client.post(
        "/api/admin/login",
        json={"username": "admin", "password": "wrong"},
        environ_base={"REMOTE_ADDR": remote_addr},
    )
    second = client.post(
        "/api/admin/login",
        json={"username": "admin", "password": "wrong-again"},
        environ_base={"REMOTE_ADDR": remote_addr},
    )
    limited = client.post(
        "/api/admin/login",
        json={"username": "admin", "password": "still-wrong"},
        environ_base={"REMOTE_ADDR": remote_addr},
    )

    assert first.status_code == 401
    assert second.status_code == 401
    assert limited.status_code == 429
    assert limited.get_json()["error"] == "rate_limited"


def test_member_resource_upload_rejects_disguised_image_content(client):
    login = client.post(
        "/api/member/login",
        json={"account": "2023001", "password": "member123"},
    )
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.get_json()['token']}"}

    response = client.post(
        "/api/member/resources/upload",
        headers=headers,
        data={
            "file": (
                BytesIO(b"<html><script>alert('xss')</script></html>"),
                "avatar.png",
            )
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 400
    assert response.get_json() == {
        "error": "invalid_file_content",
        "message": "文件内容与扩展名不匹配或存在安全风险",
    }
