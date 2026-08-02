import importlib

import pytest

import config


SECRET_CONFIG_FIELDS = (
    "SECRET_KEY",
    "JWT_SECRET_KEY",
    "OSS_ACCESS_KEY_ID",
    "OSS_ACCESS_KEY_SECRET",
    "OCR_API_KEY",
    "AI_API_KEY",
)


def test_read_secret_prefers_direct_environment_value(monkeypatch, tmp_path):
    secret_file = tmp_path / "secret"
    secret_file.write_text("from-file\n", encoding="utf-8")
    monkeypatch.setenv("TEST_SECRET", "from-environment")
    monkeypatch.setenv("TEST_SECRET_FILE", str(secret_file))

    assert config._read_secret("TEST_SECRET", "default") == "from-environment"


def test_read_secret_strips_only_terminal_line_endings(monkeypatch, tmp_path):
    secret_file = tmp_path / "secret"
    secret_file.write_text(" leading\nsecret \r\n", encoding="utf-8")
    monkeypatch.delenv("TEST_SECRET", raising=False)
    monkeypatch.setenv("TEST_SECRET_FILE", str(secret_file))

    assert config._read_secret("TEST_SECRET", "default") == " leading\nsecret "


def test_read_secret_uses_default_when_no_secret_source_is_configured(monkeypatch):
    monkeypatch.delenv("TEST_SECRET", raising=False)
    monkeypatch.delenv("TEST_SECRET_FILE", raising=False)

    assert config._read_secret("TEST_SECRET", "default") == "default"


def test_read_secret_empty_direct_environment_value_uses_file(monkeypatch, tmp_path):
    secret_file = tmp_path / "secret"
    secret_file.write_text("from-file\r\n", encoding="utf-8")
    monkeypatch.setenv("TEST_SECRET", "")
    monkeypatch.setenv("TEST_SECRET_FILE", str(secret_file))

    assert config._read_secret("TEST_SECRET", "default") == "from-file"


def test_read_secret_rejects_unreadable_file(monkeypatch, tmp_path):
    missing_file = tmp_path / "missing-secret"
    monkeypatch.delenv("TEST_SECRET", raising=False)
    monkeypatch.setenv("TEST_SECRET_FILE", str(missing_file))

    with pytest.raises(RuntimeError, match="Could not read secret file for TEST_SECRET") as error:
        config._read_secret("TEST_SECRET", "default")

    assert str(missing_file) not in str(error.value)


def test_read_secret_rejects_non_utf8_file_without_leaking_secret_content(monkeypatch, tmp_path):
    secret_file = tmp_path / "non-utf8-secret"
    secret_value = "secret-content-that-must-not-leak"
    secret_file.write_bytes(secret_value.encode("utf-8") + b"\xff")
    monkeypatch.delenv("TEST_SECRET", raising=False)
    monkeypatch.setenv("TEST_SECRET_FILE", str(secret_file))

    with pytest.raises(RuntimeError, match="Could not read secret file for TEST_SECRET") as error:
        config._read_secret("TEST_SECRET", "default")

    assert str(secret_file) not in str(error.value)
    assert secret_value not in str(error.value)


@pytest.mark.parametrize("secret_name", SECRET_CONFIG_FIELDS)
def test_config_reads_empty_direct_secret_from_file(monkeypatch, tmp_path, secret_name):
    secret_file = tmp_path / f"{secret_name.lower()}-secret"
    secret_value = f"{secret_name.lower()}-from-file"
    secret_file.write_text(f"{secret_value}\r\n", encoding="utf-8")

    try:
        with monkeypatch.context() as scoped:
            scoped.setenv(secret_name, "")
            scoped.setenv(f"{secret_name}_FILE", str(secret_file))
            reloaded_config = importlib.reload(config)

            assert getattr(reloaded_config.Config, secret_name) == secret_value
    finally:
        importlib.reload(config)
