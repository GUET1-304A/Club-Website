"""Static contract tests for the production container delivery."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _read(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


def test_production_compose_uses_private_backend_and_file_secrets():
    compose = _read("docker-compose.prod.yml")

    assert "FLASK_ENV: production" in compose
    assert "APP_DEBUG: \"false\"" in compose
    assert "gunicorn --workers 1 --threads 4" in compose
    assert "80:80" in compose
    assert "db_data_prod:/app/data" in compose
    assert "upload_data_prod:/app/uploads" in compose
    assert "backend:" in compose
    backend_section = compose.split("  frontend:", 1)[0]
    assert "ports:" not in backend_section
    assert "./backend" not in compose
    assert "./frontendnew" not in compose

    secret_names = (
        "secret_key",
        "jwt_secret_key",
        "oss_access_key_id",
        "oss_access_key_secret",
        "ocr_api_key",
        "ai_api_key",
        "feishu_webhook_url",
        "smtp_username",
        "smtp_password",
    )
    for secret_name in secret_names:
        assert f"{secret_name}:" in compose
        assert f"source: {secret_name}" in compose
        assert f"target: {secret_name}" in compose

    expected_secret_files = {
        "SECRET_KEY_FILE": "secret_key",
        "JWT_SECRET_KEY_FILE": "jwt_secret_key",
        "OSS_ACCESS_KEY_ID_FILE": "oss_access_key_id",
        "OSS_ACCESS_KEY_SECRET_FILE": "oss_access_key_secret",
        "OCR_API_KEY_FILE": "ocr_api_key",
        "AI_API_KEY_FILE": "ai_api_key",
        "FEISHU_WEBHOOK_URL_FILE": "feishu_webhook_url",
        "SMTP_USERNAME_FILE": "smtp_username",
        "SMTP_PASSWORD_FILE": "smtp_password",
    }
    for variable, secret_name in expected_secret_files.items():
        assert f"{variable}: /run/secrets/{secret_name}" in compose

    assert "CORS_ORIGINS: ${CORS_ORIGINS:?CORS_ORIGINS is required}" in compose
    assert "REMINDER_SCHEDULER_BACKEND: ${REMINDER_SCHEDULER_BACKEND:-thread}" in compose
    assert "REMINDER_SCHEDULER_LEADER: ${REMINDER_SCHEDULER_LEADER:-true}" in compose


def test_frontend_image_and_nginx_support_same_origin_spa_delivery():
    dockerfile = _read("Dockerfile.frontend.prod")
    nginx = _read("deploy/nginx/default.conf")

    assert "FROM node:24-alpine AS build" in dockerfile
    assert "npm ci" in dockerfile
    assert "npm run build" in dockerfile
    assert "FROM nginx:alpine" in dockerfile
    assert "COPY --from=build /app/dist /opt/xingyu-dist" in dockerfile
    assert "20-publish-bundle.sh" in dockerfile
    assert "VITE_BACKEND_URL=\"\"" in dockerfile

    assert "client_max_body_size 10m" in nginx
    assert "location ^~ /api/" in nginx
    assert "proxy_pass http://backend:5000" in nginx
    assert "location ^~ /uploads/" in nginx
    assert "include /etc/nginx/frontend-proxy.inc" in nginx
    assert "try_files $uri =404" in nginx
    assert "frontend_bundle_prod:/app/frontend-dist:ro" in _read("docker-compose.prod.yml")
    assert "frontend_bundle_prod:/usr/share/nginx/html" in _read("docker-compose.prod.yml")
    for header in ("Host", "X-Real-IP", "X-Forwarded-For", "X-Forwarded-Proto"):
        assert f"proxy_set_header {header}" in nginx


def test_production_examples_never_store_real_secrets_and_gunicorn_is_pinned():
    ignored = _read(".gitignore")
    docker_ignored = _read(".dockerignore")
    requirements = _read("backend/requirements.txt")

    assert "secrets/*.txt" in ignored
    assert "deploy/certs/*.pem" in ignored
    assert "gunicorn>=23,<24" in requirements
    assert "APScheduler>=3.10,<4" in requirements

    for runtime_path in (
        "backend/uploads/",
        "backend/xingyu_cms.db",
        "**/.env",
        "secrets/*.txt",
        "deploy/certs/*.pem",
    ):
        assert runtime_path in docker_ignored

    for example in (
        "secrets/secret_key.txt.example",
        "secrets/jwt_secret_key.txt.example",
        "secrets/oss_access_key_id.txt.example",
        "secrets/oss_access_key_secret.txt.example",
        "secrets/ocr_api_key.txt.example",
        "secrets/ai_api_key.txt.example",
        "secrets/bootstrap_admin_password.txt.example",
        "secrets/feishu_webhook_url.txt.example",
        "secrets/smtp_username.txt.example",
        "secrets/smtp_password.txt.example",
    ):
        content = _read(example).strip()
        assert content
        assert "REPLACE" in content

    assert _read("deploy/nginx/tls.conf.example")
    assert (ROOT / "deploy/certs/.gitkeep").is_file()


def test_tls_override_protects_transport_and_mounts_only_operator_assets():
    compose = _read("docker-compose.prod.yml")
    override = _read("docker-compose.prod.tls.yml")
    http_nginx = _read("deploy/nginx/default.conf")
    tls_nginx = _read("deploy/nginx/tls.conf")
    tls_example = _read("deploy/nginx/tls.conf.example")

    assert "BOOTSTRAP_ADMIN_USERNAME: ${BOOTSTRAP_ADMIN_USERNAME:?BOOTSTRAP_ADMIN_USERNAME is required}" in compose
    assert "BOOTSTRAP_ADMIN_PASSWORD_FILE: /run/secrets/bootstrap_admin_password" in compose
    assert "source: bootstrap_admin_password" in compose
    assert "target: bootstrap_admin_password" in compose
    assert "bootstrap_admin_password:" in compose
    assert "${BOOTSTRAP_ADMIN_PASSWORD_FILE:?Set BOOTSTRAP_ADMIN_PASSWORD_FILE" in compose

    for nginx_config in (http_nginx, tls_nginx, tls_example):
        for header in (
            "add_header X-Content-Type-Options nosniff always;",
            "add_header Referrer-Policy strict-origin-when-cross-origin always;",
            "add_header Permissions-Policy",
            "add_header X-Frame-Options SAMEORIGIN always;",
        ):
            assert header in nginx_config

    assert tls_nginx.count("add_header X-Content-Type-Options nosniff always;") >= 2
    assert "add_header Strict-Transport-Security" in tls_nginx
    assert "return 308 https://$host$request_uri;" in tls_nginx
    assert "443:443" in override
    assert "./deploy/nginx/tls.conf:/etc/nginx/conf.d/default.conf:ro" in override
    assert "./deploy/certs:/etc/nginx/certs:ro" in override
    assert '"http://127.0.0.1:8080/health/ready"' in override
    assert 'listen 127.0.0.1:8080;' in tls_nginx
    assert 'listen 127.0.0.1:8080;' in tls_example
    assert '--no-check-certificate' not in override


def test_deployment_guide_documents_safe_production_operations():
    guide = _read("docs/deployment.md")

    for heading in (
        "First start",
        "TLS",
        "Backup",
        "Restore",
        "Rotate credentials",
        "Rollback",
    ):
        assert heading in guide

    for required_detail in (
        "Compose secrets",
        "bootstrap administrator",
        "only on the first",
        "OSS",
        "OCR",
        "AI",
    ):
        assert required_detail in guide


def test_production_design_and_plan_cover_the_release_security_boundaries():
    design = _read("docs/superpowers/specs/2026-07-28-production-deployment-design.md")
    plan = _read("docs/superpowers/plans/2026-07-28-production-deployment.md")

    for document in (design, plan):
        for required_detail in (
            "bootstrap_admin_password",
            "BOOTSTRAP_ADMIN_USERNAME",
            "SEED_DEMO_DATA",
            "backend/uploads/",
            "docker-compose.prod.tls.yml",
            "Strict-Transport-Security",
        ):
            assert required_detail in document
