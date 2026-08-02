import sys
from pathlib import Path

import pytest


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app import create_app


@pytest.fixture(scope="module")
def app(tmp_path_factory):
    db_path = tmp_path_factory.mktemp("runtime-smoke") / "test.db"

    with pytest.MonkeyPatch.context() as monkeypatch:
        monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
        monkeypatch.setenv("FLASK_ENV", "testing")
        monkeypatch.setenv("APP_DEBUG", "false")
        yield create_app("testing")


@pytest.fixture
def client(app):
    return app.test_client()
