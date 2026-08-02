from pathlib import Path
import os
import subprocess


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def test_environment_example_documents_required_runtime_keys_without_known_secrets():
    environment_example = PROJECT_ROOT / ".env.example"

    assert environment_example.is_file()

    documented_keys = {
        line.split("=", 1)[0]
        for line in environment_example.read_text(encoding="utf-8").splitlines()
        if line and not line.startswith("#") and "=" in line
    }

    assert {"SECRET_KEY", "JWT_SECRET_KEY", "DATABASE_URL", "CORS_ORIGINS", "UPLOAD_FOLDER"} <= documented_keys

    values = {
        line.split("=", 1)[0]: line.split("=", 1)[1]
        for line in environment_example.read_text(encoding="utf-8").splitlines()
        if line and not line.startswith("#") and "=" in line
    }
    assert values["SECRET_KEY"] in {"", "replace-with-generated-secret-key"}
    assert values["JWT_SECRET_KEY"] in {"", "replace-with-generated-jwt-secret-key"}


def test_compose_requires_explicit_secrets_and_renders_generated_env_file(tmp_path):
    """Compose must refuse missing secrets and render values from an untracked env file."""
    environment = os.environ.copy()
    for key in (
        "FLASK_ENV",
        "APP_DEBUG",
        "SECRET_KEY",
        "JWT_SECRET_KEY",
        "DATABASE_URL",
        "CORS_ORIGINS",
        "UPLOAD_FOLDER",
    ):
        environment.pop(key, None)

    missing_secrets = subprocess.run(
        ["docker", "compose", "config"],
        cwd=PROJECT_ROOT,
        env=environment,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    assert missing_secrets.returncode != 0

    secret_key = "test-secret-key-6c9d8b3f"
    jwt_secret_key = "test-jwt-secret-key-7e2a1f4c"
    env_file = tmp_path / "runtime-test.env"
    env_file.write_text(
        "\n".join(
            (
                "FLASK_ENV=development",
                "APP_DEBUG=false",
                f"SECRET_KEY={secret_key}",
                f"JWT_SECRET_KEY={jwt_secret_key}",
                "DATABASE_URL=sqlite:////app/data/xingyu_cms.db",
                "CORS_ORIGINS=http://localhost:3000",
                "UPLOAD_FOLDER=/app/uploads",
            )
        ),
        encoding="utf-8",
    )
    result = subprocess.run(
        ["docker", "compose", "--env-file", str(env_file), "config"],
        cwd=PROJECT_ROOT,
        env=environment,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=True,
    )

    config = result.stdout
    for key in ("SECRET_KEY", "JWT_SECRET_KEY", "DATABASE_URL", "CORS_ORIGINS", "UPLOAD_FOLDER"):
        assert f"{key}:" in config
    assert secret_key in config
    assert jwt_secret_key in config
    assert "APP_DEBUG: \"false\"" in config


def test_backend_container_does_not_force_debug_mode():
    dockerfile = (PROJECT_ROOT / "Dockerfile.backend").read_text(encoding="utf-8")

    assert "debug=True" not in dockerfile
    assert "app.run(host=app.config['APP_HOST'], port=app.config['APP_PORT'])" in dockerfile


def test_health_returns_ok(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.is_json
    assert response.get_json()["status"] == "ok"


def test_public_config_is_available_without_authentication(client):
    response = client.get("/api/config")

    assert response.status_code == 200
    assert response.is_json
    assert isinstance(response.get_json(), dict)


def test_member_me_requires_bearer_token(client):
    response = client.get("/api/member/me")

    assert response.status_code == 401
