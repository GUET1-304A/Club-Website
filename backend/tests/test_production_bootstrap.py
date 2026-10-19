"""Production startup must never install the development demo dataset."""

import importlib

import pytest

import app as app_module
import config as config_module
from models import AdminUser, Award, BlogPost, Member, Notification, Project


def _create_isolated_app(monkeypatch, tmp_path, config_name, *, username=None, password=None):
    database_path = tmp_path / f"{config_name}.db"
    upload_path = tmp_path / "uploads"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database_path.as_posix()}")
    monkeypatch.setenv("UPLOAD_FOLDER", str(upload_path))
    monkeypatch.setenv("CORS_ORIGINS", "http://testserver")
    monkeypatch.delenv("BOOTSTRAP_ADMIN_USERNAME", raising=False)
    monkeypatch.delenv("BOOTSTRAP_ADMIN_PASSWORD", raising=False)
    monkeypatch.delenv("BOOTSTRAP_ADMIN_PASSWORD_FILE", raising=False)

    if username is not None:
        monkeypatch.setenv("BOOTSTRAP_ADMIN_USERNAME", username)
    if password is not None:
        password_file = tmp_path / "bootstrap-admin-password"
        password_file.write_text(f"{password}\n", encoding="utf-8")
        monkeypatch.setenv("BOOTSTRAP_ADMIN_PASSWORD_FILE", str(password_file))

    importlib.reload(config_module)
    importlib.reload(app_module)
    return app_module.create_app(config_name)


@pytest.fixture(autouse=True)
def _restore_config_after_test():
    yield
    importlib.reload(config_module)
    importlib.reload(app_module)


def test_production_requires_explicit_bootstrap_admin_credentials(monkeypatch, tmp_path):
    with pytest.raises(RuntimeError, match="BOOTSTRAP_ADMIN_USERNAME"):
        _create_isolated_app(monkeypatch, tmp_path, "production")


def test_production_creates_only_explicit_bootstrap_admin_without_demo_data(monkeypatch, tmp_path):
    app = _create_isolated_app(
        monkeypatch,
        tmp_path,
        "production",
        username="bootstrap-admin",
        password="bootstrap-password-not-a-default",
    )

    with app.app_context():
        admin = AdminUser.query.one()
        assert admin.username == "bootstrap-admin"
        assert admin.check_password("bootstrap-password-not-a-default")
        assert AdminUser.query.count() == 1
        assert Member.query.count() == 0
        assert Project.query.count() == 0
        assert Award.query.count() == 0
        assert BlogPost.query.count() == 0
        assert Notification.query.count() == 0


def test_development_keeps_demo_seed_data(monkeypatch, tmp_path):
    app = _create_isolated_app(monkeypatch, tmp_path, "development")

    with app.app_context():
        assert AdminUser.query.filter_by(username="admin").first().check_password("admin123")
        assert Member.query.count() > 0
        # 项目不再有默认数据：作品由管理员在后台自行创建或导入
        assert Project.query.count() == 0
        # 奖项同样不再有默认数据
        assert Award.query.count() == 0
        # 博客同样不再有默认数据
        assert BlogPost.query.count() == 0
        # 通知同样不再有默认数据
        assert Notification.query.count() == 0
