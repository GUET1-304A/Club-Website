import uuid
from pathlib import Path

from models import Certificate, Notification, Project, ResourceFolder, Task, db


def test_member_can_manage_own_identity_without_exposing_password_data(client):
    login = client.post(
        "/api/member/login",
        json={"account": "2023001", "password": "member123"},
    )

    assert login.status_code == 200
    login_data = login.get_json()
    token = login_data["token"]
    assert login_data["member"]["studentId"] == "2023001"
    assert "password_hash" not in login_data["member"]
    assert "passwordHash" not in login_data["member"]

    headers = {"Authorization": f"Bearer {token}"}
    profile = client.get("/api/member/me", headers=headers)

    assert profile.status_code == 200
    profile_data = profile.get_json()
    assert profile_data["studentId"] == "2023001"
    assert "password_hash" not in profile_data
    assert "passwordHash" not in profile_data

    update = client.put(
        "/api/member/me",
        headers=headers,
        json={"bio": "integration bio"},
    )

    assert update.status_code == 200
    update_data = update.get_json()
    assert update_data["member"]["bio"] == "integration bio"
    assert "password_hash" not in update_data["member"]
    assert "passwordHash" not in update_data["member"]

    password_change = client.put(
        "/api/member/me/password",
        headers=headers,
        json={"currentPassword": "member123", "newPassword": "member456"},
    )

    assert password_change.status_code == 200
    assert password_change.get_json()["success"] is True

    relogin = client.post(
        "/api/member/login",
        json={"account": "2023001", "password": "member456"},
    )

    assert relogin.status_code == 200
    relogin_data = relogin.get_json()
    assert relogin_data["member"]["studentId"] == "2023001"
    assert "password_hash" not in relogin_data["member"]
    assert "passwordHash" not in relogin_data["member"]


def test_member_project_task_lifecycle(client):
    login = client.post(
        "/api/member/login",
        json={"account": "2023002", "password": "member123"},
    )
    assert login.status_code == 200
    login_data = login.get_json()
    headers = {"Authorization": f"Bearer {login_data['token']}"}
    member_id = login_data["member"]["id"]

    projects = client.get("/api/member/projects", headers=headers)
    assert projects.status_code == 200
    project_list = projects.get_json()
    assert project_list
    project_id = project_list[0]["id"]

    task_id = None
    try:
        created = client.post(
            f"/api/member/projects/{project_id}/tasks",
            headers=headers,
            json={
                "title": "Integration task",
                "status": "todo",
                "assigneeId": member_id,
                "priority": "medium",
                "sortOrder": 0,
            },
        )

        assert created.status_code == 201
        task = created.get_json()["task"]
        task_id = task["id"]
        assert task["assignee_id"] == member_id
        assert task["status"] == "todo"

        changed = client.put(
            f"/api/member/tasks/{task_id}/status",
            headers=headers,
            json={"status": "done"},
        )

        assert changed.status_code == 200
        assert changed.get_json()["task"]["status"] == "done"

        assert client.post(
            f"/api/member/projects/{project_id}/tasks",
            json={"title": "blocked"},
        ).status_code == 401
        assert client.put(
            f"/api/member/tasks/{task_id}/status",
            headers=headers,
            json={"status": "invalid"},
        ).status_code == 400
    finally:
        if task_id is not None:
            with client.application.app_context():
                task = db.session.get(Task, task_id)
                if task is not None:
                    db.session.delete(task)
                    db.session.commit()
                assert db.session.get(Task, task_id) is None


def test_admin_can_manage_project_content_and_view_applications(client):
    login = client.post(
        "/api/admin/login",
        json={"username": "admin", "password": "admin123"},
    )

    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.get_json()['token']}"}
    slug = f"admin-content-flow-{uuid.uuid4().hex}"
    project_id = None

    try:
        created = client.post(
            "/api/admin/projects",
            headers=headers,
            json={"name": "Admin content flow", "slug": slug},
        )

        assert created.status_code == 201
        project_id = created.get_json()["project"]["id"]

        updated = client.put(
            f"/api/admin/projects/{project_id}",
            headers=headers,
            json={"description": "Updated by the admin content flow."},
        )

        assert updated.status_code == 200
        assert updated.get_json()["project"]["description"] == "Updated by the admin content flow."

        assert client.post(
            "/api/admin/projects",
            json={"name": "Unauthorized project", "slug": f"unauthorized-{uuid.uuid4().hex}"},
        ).status_code == 401

        assert client.get("/api/admin/applications", headers=headers).status_code == 200
    finally:
        if project_id is not None:
            with client.application.app_context():
                project = db.session.get(Project, project_id)
                if project is not None:
                    db.session.delete(project)
                    db.session.commit()
                assert db.session.get(Project, project_id) is None


def test_member_can_manage_resource_folder_and_certificate(client):
    login = client.post(
        "/api/member/login",
        json={"account": "2023002", "password": "member123"},
    )
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.get_json()['token']}"}
    folder_id = None
    certificate_id = None
    deleted_certificate_id = None

    try:
        created_folder = client.post(
            "/api/member/resources/folders",
            headers=headers,
            json={"name": "Integration resource folder"},
        )

        assert created_folder.status_code == 201
        folder = created_folder.get_json()["folder"]
        folder_id = folder["id"]
        assert folder["name"] == "Integration resource folder"

        folders = client.get("/api/member/resources/folders", headers=headers)
        assert folders.status_code == 200
        assert any(item["id"] == folder_id for item in folders.get_json())

        missing_name = client.post(
            "/api/member/certificates",
            headers=headers,
            json={},
        )
        assert missing_name.status_code == 400

        created_certificate = client.post(
            "/api/member/certificates",
            headers=headers,
            json={"name": "Integration certificate", "level": "school"},
        )

        assert created_certificate.status_code == 201
        certificate = created_certificate.get_json()["certificate"]
        certificate_id = certificate["id"]
        assert certificate["name"] == "Integration certificate"
        assert certificate["status"] == "pending"

        updated_certificate = client.put(
            f"/api/member/certificates/{certificate_id}",
            headers=headers,
            json={"issuer": "Integration issuer"},
        )
        assert updated_certificate.status_code == 200
        assert updated_certificate.get_json()["certificate"]["issuer"] == "Integration issuer"

        deleted_certificate = client.delete(
            f"/api/member/certificates/{certificate_id}",
            headers=headers,
        )
        assert deleted_certificate.status_code == 200
        deleted_certificate_id = certificate_id
        certificate_id = None
    finally:
        with client.application.app_context():
            if certificate_id is not None:
                certificate = db.session.get(Certificate, certificate_id)
                if certificate is not None:
                    db.session.delete(certificate)
            if folder_id is not None:
                folder = db.session.get(ResourceFolder, folder_id)
                if folder is not None:
                    db.session.delete(folder)
            db.session.commit()
            if folder_id is not None:
                assert db.session.get(ResourceFolder, folder_id) is None
            if certificate_id is not None:
                assert db.session.get(Certificate, certificate_id) is None
            if deleted_certificate_id is not None:
                assert db.session.get(Certificate, deleted_certificate_id) is None


def test_member_notifications_and_upload_boundary(client):
    login = client.post(
        "/api/member/login",
        json={"account": "2022001", "password": "member123"},
    )
    assert login.status_code == 200
    login_data = login.get_json()
    headers = {"Authorization": f"Bearer {login_data['token']}"}
    notification_ids = []
    notification_marker = uuid.uuid4().hex

    try:
        with client.application.app_context():
            notifications = [
                Notification(
                    member_id=login_data["member"]["id"],
                    type="announcement",
                    title=f"Integration notification {notification_marker} one",
                    body="First test notification.",
                    is_read=False,
                ),
                Notification(
                    member_id=login_data["member"]["id"],
                    type="announcement",
                    title=f"Integration notification {notification_marker} two",
                    body="Second test notification.",
                    is_read=False,
                ),
            ]
            db.session.add_all(notifications)
            db.session.commit()
            notification_ids = [notification.id for notification in notifications]

        listed = client.get("/api/member/notifications", headers=headers)
        assert listed.status_code == 200
        listed_items = {
            item["id"]: item
            for item in listed.get_json()
            if item["id"] in notification_ids
        }
        assert set(listed_items) == set(notification_ids)
        assert all(item["isRead"] is False for item in listed_items.values())

        marked_read = client.put(
            f"/api/member/notifications/{notification_ids[0]}/read",
            headers=headers,
        )
        assert marked_read.status_code == 200
        assert marked_read.get_json()["success"] is True

        after_single_read = client.get("/api/member/notifications", headers=headers)
        assert after_single_read.status_code == 200
        after_single_items = {
            item["id"]: item
            for item in after_single_read.get_json()
            if item["id"] in notification_ids
        }
        assert after_single_items[notification_ids[0]]["isRead"] is True
        assert after_single_items[notification_ids[1]]["isRead"] is False

        marked_all_read = client.put("/api/member/notifications/read-all", headers=headers)
        assert marked_all_read.status_code == 200
        assert marked_all_read.get_json()["success"] is True

        after_all_read = client.get("/api/member/notifications", headers=headers)
        assert after_all_read.status_code == 200
        after_all_items = {
            item["id"]: item
            for item in after_all_read.get_json()
            if item["id"] in notification_ids
        }
        assert set(after_all_items) == set(notification_ids)
        assert all(item["isRead"] is True for item in after_all_items.values())
    finally:
        with client.application.app_context():
            for notification_id in notification_ids:
                notification = db.session.get(Notification, notification_id)
                if notification is not None:
                    db.session.delete(notification)
            db.session.commit()
            for notification_id in notification_ids:
                assert db.session.get(Notification, notification_id) is None

    assert client.post("/api/member/resources/upload").status_code == 401
    assert client.post("/api/member/certificates/upload").status_code == 401

    upload_path = Path(client.application.config["UPLOAD_FOLDER"]).resolve()
    backend_path = Path(client.application.root_path).resolve()
    if upload_path.is_relative_to(backend_path):
        assert upload_path.is_dir()


def test_admin_project_health_returns_statistics(client):
    login = client.post(
        "/api/admin/login",
        json={"username": "admin", "password": "admin123"},
    )
    assert login.status_code == 200
    admin_headers = {"Authorization": f"Bearer {login.get_json()['token']}"}
    project_id = None
    task_ids = []
    try:
        with client.application.app_context():
            project = Project(
                slug=f"health-{uuid.uuid4().hex[:8]}",
                name="健康度测试项目",
                status="active",
            )
            db.session.add(project)
            db.session.commit()
            project_id = project.id
            for status in ("todo", "done", "in_progress"):
                task = Task(project_id=project.id, title=f"任务-{status}", status=status)
                db.session.add(task)
                db.session.flush()
                task_ids.append(task.id)
            db.session.commit()

        response = client.get(
            f"/api/admin/projects/{project_id}/health",
            headers=admin_headers,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["taskTotal"] == 3
        assert data["taskDone"] == 1
        assert data["completionRate"] == round(1 / 3 * 100, 1)
        assert data["byStatus"]["todo"] == 1
        assert data["byStatus"]["done"] == 1
        assert data["byStatus"]["in_progress"] == 1
        assert "overdueTaskCount" in data
        assert "memberWorkload" in data
        assert "milestoneCount" in data

        missing = client.get(
            "/api/admin/projects/999999/health",
            headers=admin_headers,
        )
        assert missing.status_code == 404
    finally:
        with client.application.app_context():
            for task_id in task_ids:
                task = db.session.get(Task, task_id)
                if task is not None:
                    db.session.delete(task)
            if project_id is not None:
                project = db.session.get(Project, project_id)
                if project is not None:
                    db.session.delete(project)
            db.session.commit()
