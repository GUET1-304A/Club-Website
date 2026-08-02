# Production Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a production Docker deployment with same-origin Nginx, durable local data, and file-based secret injection for real OSS/OCR/AI credentials.

**Architecture:** Flask resolves sensitive configuration from a direct variable or its `*_FILE` counterpart. A private backend runs behind Nginx in `docker-compose.prod.yml`; a multi-stage frontend image serves the built SPA and proxies API and uploads. Docker secrets mount sensitive values without rendering them in the backend environment.

**Tech Stack:** Flask, pytest, Docker Compose, Docker secrets, Nginx, React/Vite.

---

### Task 1: Add file-backed secret configuration

**Files:**

- Modify: `backend/config.py`
- Create: `backend/tests/test_config_secrets.py`

- [ ] **Step 1: Write failing secret-resolution tests**

```python
def test_secret_prefers_direct_environment_value(monkeypatch, tmp_path):
    secret_file = tmp_path / 'secret.txt'
    secret_file.write_text('from-file\n', encoding='utf-8')
    monkeypatch.setenv('OCR_API_KEY', 'from-env')
    monkeypatch.setenv('OCR_API_KEY_FILE', str(secret_file))

    assert _read_secret('OCR_API_KEY') == 'from-env'


def test_secret_reads_trimmed_file_value(monkeypatch, tmp_path):
    secret_file = tmp_path / 'secret.txt'
    secret_file.write_text('from-file\n', encoding='utf-8')
    monkeypatch.delenv('OCR_API_KEY', raising=False)
    monkeypatch.setenv('OCR_API_KEY_FILE', str(secret_file))

    assert _read_secret('OCR_API_KEY') == 'from-file'
```

- [ ] **Step 2: Verify red**

Run: `py -m pytest -q backend/tests/test_config_secrets.py`

Expected: FAIL because `_read_secret` does not exist.

- [ ] **Step 3: Implement the minimal resolver and apply it to six sensitive settings**

```python
def _read_secret(name, default=''):
    direct_value = os.environ.get(name)
    if direct_value:
        return direct_value
    secret_path = os.environ.get(f'{name}_FILE')
    if not secret_path:
        return default
    try:
        return Path(secret_path).read_text(encoding='utf-8').rstrip('\r\n')
    except OSError as exc:
        raise RuntimeError(f'Unable to read {name}_FILE') from exc
```

Use it for the listed sensitive keys while retaining the current development
defaults only when no direct value and no file variable are provided.

- [ ] **Step 4: Verify green**

Run: `py -m pytest -q backend/tests/test_config_secrets.py`

Expected: PASS.

### Task 2: Build and route the production images

**Files:**

- Create: `Dockerfile.frontend.prod`
- Create: `deploy/nginx/default.conf`
- Create: `docker-compose.prod.yml`
- Create: `secrets/secret_key.txt.example`
- Create: `secrets/jwt_secret_key.txt.example`
- Create: `secrets/oss_access_key_id.txt.example`
- Create: `secrets/oss_access_key_secret.txt.example`
- Create: `secrets/ocr_api_key.txt.example`
- Create: `secrets/ai_api_key.txt.example`
- Modify: `.gitignore`

- [ ] **Step 1: Write the failing Compose contract check**

```python
def test_production_compose_mounts_backend_secrets_and_publishes_only_nginx():
    config = render_compose('docker-compose.prod.yml')

    assert config['services']['backend'].get('ports') is None
    assert config['services']['frontend']['ports'] == ['80:80']
    assert 'secret_key' in config['services']['backend']['secrets']
```

- [ ] **Step 2: Verify red**

Run: `py -m pytest -q backend/tests/test_deployment_contract.py`

Expected: FAIL because no production Compose file exists.

- [ ] **Step 3: Implement release containers**

Use a Node build stage and `nginx:alpine` runtime stage. Configure Nginx to
fallback SPA paths to `/index.html`, proxy `/api/` and `/uploads/`, set request
size to `MAX_CONTENT_LENGTH`'s deployment value, and forward normal proxy
headers. Add a private backend service with named `db_data_prod` and
`upload_data_prod` volumes and the six Compose secret mounts. Keep the local
development `docker-compose.yml` unchanged.

- [ ] **Step 4: Verify green**

Run: `docker compose -f docker-compose.prod.yml config`

Expected: success using only placeholder non-secret values and six file secret
mounts; backend has no published port or sensitive values in `environment`.

### Task 3: Document safe operations and verify delivery

**Files:**

- Create: `docs/deployment.md`
- Modify: `.env.example`
- Modify: `docs/integrations.md`

- [ ] **Step 1: Write the failing documentation assertions**

```python
def test_deployment_guide_documents_backup_restore_and_secret_rotation():
    guide = Path('docs/deployment.md').read_text(encoding='utf-8')

    for heading in ('Backup', 'Restore', 'Rotate credentials', 'Rollback'):
        assert heading in guide
```

- [ ] **Step 2: Verify red**

Run: `py -m pytest -q backend/tests/test_deployment_contract.py`

Expected: FAIL because the guide does not exist.

- [ ] **Step 3: Add operator instructions**

Document secret-file creation, placeholder replacement, production start,
TLS certificate mounting, health checks, SQLite/uploads backup and restore,
credential rotation, image rollback, and the real OSS/OCR/AI configuration
boundaries. Clarify that `.env.example` supports development values while
production uses secrets and never commits them.

- [ ] **Step 4: Verify full delivery**

Run: `py -m pytest -q`, `npm run check`, `npm run build`, and
`docker compose -f docker-compose.prod.yml config`.

Expected: all commands exit `0`; report existing non-fatal frontend warnings
separately.

### Task 4: Harden first production boot and TLS transport

**Files:**

- Modify: `.dockerignore`, `backend/config.py`, `backend/app.py`,
  `docker-compose.prod.yml`, `deploy/nginx/default.conf`
- Create: `backend/tests/test_production_bootstrap.py`,
  `docker-compose.prod.tls.yml`, `deploy/nginx/tls.conf`,
  `secrets/bootstrap_admin_password.txt.example`, `docs/deployment.md`

- [ ] Exclude `backend/uploads/`, local SQLite state, environment files,
  untracked secrets, and PEM certificates from the Docker build context; verify
  the built backend image has no runtime uploads, database, or `.env` file.
- [ ] Set `SEED_DEMO_DATA=False` in production. Require
  `BOOTSTRAP_ADMIN_USERNAME` and the `bootstrap_admin_password` file secret
  (`BOOTSTRAP_ADMIN_PASSWORD_FILE`) for its explicit first administrator, and
  verify production does not seed demonstration records.
- [ ] Add `docker-compose.prod.tls.yml` to publish 443 and mount TLS assets
  read-only while preserving the port-80 redirect. Apply the baseline response
  headers to HTTP and TLS plus `Strict-Transport-Security` on HTTPS.
- [ ] Document initial secret creation, first boot, TLS, backup/restore,
  rotation, rollback, and the OSS/OCR/AI provider placeholders. Validate both
  base and TLS Compose renders with disposable secret examples.
