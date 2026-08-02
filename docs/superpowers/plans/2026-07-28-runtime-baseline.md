# Runtime Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `worktree-final-prompt` reproducibly buildable and locally runnable through Docker, with automated health and API contract verification.

**Architecture:** Retain React/Vite and Flask. Introduce an isolated pytest app fixture backed by a temporary SQLite database, use the TypeScript production build as the frontend syntax gate, and align the Compose database URI with its persistent volume. Do not reset, discard, or accidentally stage pre-existing dirty backend changes.

**Tech Stack:** React 19, TypeScript, Vite, Flask 3, Flask-SQLAlchemy, Flask-JWT-Extended, pytest, Docker Compose.

---

## File structure

- Create `backend/tests/conftest.py`: temporary-database Flask fixture.
- Create `backend/tests/test_health_and_public.py`: health, public and auth-boundary smoke tests.
- Create `backend/requirements-dev.txt`: pytest dependencies.
- Modify `backend/config.py`: `testing` configuration selected by `FLASK_ENV`.
- Modify `frontendnew/package.json` and failing `frontendnew/src/**/*.tsx`: repeatable compiler gate and syntax repairs.
- Modify `docker-compose.yml`: persistent SQLite URI, upload volume, healthcheck dependency.
- Create `.env.example` and `docs/verification/runtime-baseline.md`: complete non-secret runtime contract and verification guide.

### Task 1: Add isolated backend smoke coverage

**Files:**
- Create: `backend/requirements-dev.txt`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_health_and_public.py`
- Modify: `backend/config.py`

- [ ] **Step 1: Write failing API tests**

```python
def test_health_returns_running_status(client):
    response = client.get('/health')
    assert response.status_code == 200
    assert response.is_json
    assert response.get_json()['status'] == 'ok'


def test_public_config_is_available_without_token(client):
    response = client.get('/api/config')
    assert response.status_code == 200
    assert isinstance(response.get_json(), dict)


def test_member_endpoint_requires_bearer_token(client):
    assert client.get('/api/member/me').status_code == 401
```

- [ ] **Step 2: Run the failing test file**

Run: `python -m pytest backend/tests/test_health_and_public.py -v`

Expected: FAIL because pytest or the `client` fixture does not exist.

- [ ] **Step 3: Add test dependencies and fixture**

```text
# backend/requirements-dev.txt
-r requirements.txt
pytest>=8.0,<9.0
```

```python
# backend/tests/conftest.py
import sys
from pathlib import Path
import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))


@pytest.fixture()
def app(tmp_path, monkeypatch):
    monkeypatch.setenv('FLASK_ENV', 'testing')
    monkeypatch.setenv('DATABASE_URL', f"sqlite:///{tmp_path / 'test.db'}")
    monkeypatch.setenv('APP_DEBUG', 'false')
    from app import create_app
    application = create_app('testing')
    application.config.update(TESTING=True)
    return application


@pytest.fixture()
def client(app):
    return app.test_client()
```

- [ ] **Step 4: Add the testing configuration**

```python
class TestingConfig(Config):
    TESTING = True
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = os.environ['DATABASE_URL']


config['testing'] = TestingConfig
```

- [ ] **Step 5: Run the tests until they pass**

Run: `python -m pytest backend/tests/test_health_and_public.py -v`

Expected: three PASS results.

- [ ] **Step 6: Commit only the smoke-test change set**

Run:

```bash
git add backend/config.py backend/requirements-dev.txt backend/tests/conftest.py backend/tests/test_health_and_public.py
git commit -m "test: add backend runtime smoke coverage"
```

### Task 2: Restore frontend compiler verification

**Files:**
- Modify: `frontendnew/package.json`
- Modify: all compiler-reported `frontendnew/src/**/*.tsx` files

- [ ] **Step 1: Prove the current build is blocked**

Run: `npm ci`

Expected: exits 0 and installs the exact lockfile dependencies.

Run: `npm run build`

Expected: FAIL with TypeScript/JSX parser diagnostics, including unterminated attributes in `components/pages/LoginPage.tsx` and `components/member/MemberLogin.tsx`.

- [ ] **Step 2: Add repeatable scripts**

```json
"scripts": {
  "dev": "vite",
  "typecheck": "tsc -b --pretty false",
  "check": "npm run typecheck && npm run lint",
  "build": "tsc -b && vite build",
  "lint": "oxlint",
  "preview": "vite preview"
}
```

- [ ] **Step 3: Fix every reported unterminated JSX attribute without altering business behaviour**

```tsx
// before
placeholder="Password
autoComplete="current-password"

// after
placeholder="Password"
autoComplete="current-password"
```

Correct the compiler-reported instances in `LoginPage.tsx`, `MemberLogin.tsx`, `AdminAwards.tsx`, `ResourceCenter.tsx` and every additional reported source file. Do not replace working API calls or component state while doing these syntax-only repairs.

- [ ] **Step 4: Run the compiler gate**

Run: `npm run check`

Expected: exits 0.

Run: `npm run build`

Expected: exits 0 and creates `frontendnew/dist`.

- [ ] **Step 5: Commit only frontend compiler repairs**

Run:

```bash
git add frontendnew/package.json frontendnew/package-lock.json frontendnew/src
git commit -m "fix: restore frontend TypeScript build"
```

### Task 3: Align Compose persistence and service readiness

**Files:**
- Modify: `docker-compose.yml`
- Modify: `backend/tests/test_health_and_public.py`

- [ ] **Step 1: Add the configuration-contract test**

```python
from conftest import BACKEND_DIR


def test_env_example_documents_runtime_keys():
    example = (BACKEND_DIR.parent / '.env.example').read_text(encoding='utf-8')
    for key in ('SECRET_KEY', 'JWT_SECRET_KEY', 'DATABASE_URL', 'CORS_ORIGINS', 'UPLOAD_FOLDER'):
        assert f'{key}=' in example
```

- [ ] **Step 2: Run the test to prove the example file is missing**

Run: `python -m pytest backend/tests/test_health_and_public.py::test_env_example_documents_runtime_keys -v`

Expected: FAIL with `FileNotFoundError`.

- [ ] **Step 3: Add the non-secret environment template**

```dotenv
FLASK_ENV=production
APP_DEBUG=false
SECRET_KEY=replace-with-a-long-random-secret
JWT_SECRET_KEY=replace-with-a-different-long-random-secret
DATABASE_URL=sqlite:////app/data/xingyu_cms.db
CORS_ORIGINS=https://example.com
UPLOAD_FOLDER=/app/uploads
VITE_BACKEND_URL=http://backend:5000
OSS_ENABLED=false
OSS_ENDPOINT=
OSS_BUCKET=
OSS_ACCESS_KEY_ID=
OSS_ACCESS_KEY_SECRET=
OCR_ENABLED=false
OCR_PROVIDER=
OCR_API_KEY=
AI_ENABLED=false
AI_PROVIDER=
AI_API_KEY=
AI_BASE_URL=
AI_MODEL=
```

- [ ] **Step 4: Correct the Compose storage and readiness contract**

Add these backend environment values:

```yaml
DATABASE_URL: sqlite:////app/data/xingyu_cms.db
UPLOAD_FOLDER: /app/uploads
```

Keep `db_data:/app/data`, add `upload_data:/app/uploads`, configure a backend healthcheck against `http://localhost:5000/health`, and make frontend startup depend on `backend` being `service_healthy`.

- [ ] **Step 5: Run backend and Docker verification**

Run: `python -m pytest backend/tests -v`

Expected: all PASS.

Run: `docker compose config`

Expected: exits 0 and includes the persistent database URI, both volumes and the backend healthcheck.

Run: `docker compose up --build -d`

Expected: backend becomes healthy before frontend starts.

Run: `docker compose ps`

Expected: backend reports `healthy`.

- [ ] **Step 6: Write the baseline runbook and commit**

Document `npm ci`, `npm run check`, `npm run build`, `python -m pytest backend/tests -v`, `docker compose up --build -d`, `docker compose ps`, and `docker compose down` in `docs/verification/runtime-baseline.md`; state that `.env` files must not be committed.

Run:

```bash
git add .env.example docker-compose.yml backend/tests/test_health_and_public.py docs/verification/runtime-baseline.md
git commit -m "docs: define runtime configuration contract"
```

## Plan self-review

- Approved-design coverage: this plan fully covers phase 1 (build, dependencies, Docker, environment contract and smoke tests).
- Deferred by design: member/admin flow completion, OSS/OCR/AI adapters and production deployment each receive their own executable plan after this baseline passes.
- Consistency: tests use the `app`/`client` fixtures and `testing` config defined in Task 1; all listed runtime configuration keys appear in Task 3.
