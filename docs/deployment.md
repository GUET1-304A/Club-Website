# Production deployment

This deployment keeps the Flask backend private behind Nginx. It uses Compose
secrets: file contents are mounted below `/run/secrets` and are not placed in
the backend environment as credential values.

## Development quick start (Docker Compose)

The root `docker-compose.yml` starts a hot-reload development environment
(backend on `http://localhost:5000`, frontend on `http://localhost:3000`).
It requires `SECRET_KEY` and `JWT_SECRET_KEY`; provide them in a `.env` file
or as environment variables:

```powershell
# PowerShell
$env:SECRET_KEY = 'replace-with-a-long-random-string'
$env:JWT_SECRET_KEY = 'replace-with-another-long-random-string'
docker compose --env-file .env.local up -d --build
```

```bash
# Linux/macOS
SECRET_KEY=replace-with-a-long-random-string \
JWT_SECRET_KEY=replace-with-another-long-random-string \
docker compose up -d --build
```

For this Windows checkout, retain the existing untracked `.env.local` and pass
`--env-file .env.local` explicitly on every development Compose command. Never
print its secret values when collecting diagnostics.

Development mode seeds demo data (admin `admin/admin123`, demo members).
Verify with `docker compose ps`, `curl http://localhost:5000/health`, and
`curl http://localhost:3000`.

## First start

1. Copy each `secrets/*.txt.example` file to the matching untracked `.txt`
   file and replace every `REPLACE_*` value with a generated secret. Restrict
   file permissions to the deployment operator.
2. Set the seven required host-file variables: `SECRET_KEY_FILE`, `JWT_SECRET_KEY_FILE`,
   `OSS_ACCESS_KEY_ID_FILE`, `OSS_ACCESS_KEY_SECRET_FILE`, `OCR_API_KEY_FILE`,
   `AI_API_KEY_FILE`, and `BOOTSTRAP_ADMIN_PASSWORD_FILE`. Set a non-secret
   `BOOTSTRAP_ADMIN_USERNAME` and the required public `CORS_ORIGINS` value.
3. Set `PUBLIC_BASE_URL` and `CORS_ORIGINS` to the actual HTTPS origin. For the
   checked release workflow below, keep the existing installation's `.env`,
   `secrets/` and `deploy/certs/` at the installation root.
4. Use the checked release workflow below. Manual Compose remains available for
   local rehearsals, but does not run the release gates or create a data backup.

The bootstrap administrator is created only on the first empty production
database. Later starts do not replace an existing administrator; never use the
development `admin/admin123` account in production.

## TLS

Place issuer-managed `fullchain.pem` and `privkey.pem` in `deploy/certs/`,
which is ignored by Git. Start with the TLS override to keep port 80 redirecting
to HTTPS and to publish port 443:

```sh
docker compose -f docker-compose.prod.yml -f docker-compose.prod.tls.yml up -d
```

`deploy/nginx/tls.conf` is mounted read-only. Update its `server_name` before
deployment; `tls.conf.example` is the tracked reference configuration.
The TLS override checks readiness over a loopback-only Nginx listener on port
8080 inside the frontend container. It does not follow the public HTTP redirect
or disable certificate validation. Release smoke tests still use the public
HTTPS origin with normal certificate and hostname validation.

## External notifications

Internal database notifications are always written. Feishu and SMTP email are
optional best-effort channels for reminders, weekly report submissions, and AI
weekly report analysis summaries. External delivery failures are logged and do
not roll back the main workflow.

To enable Feishu, copy `secrets/feishu_webhook_url.txt.example` to an
untracked secret file, replace the `REPLACE_*` value, and set:

```sh
NOTIFICATION_FEISHU_ENABLED=true
FEISHU_WEBHOOK_URL_FILE=/absolute/path/to/feishu_webhook_url.txt
PUBLIC_BASE_URL=https://your-domain.example
```

To enable SMTP email, configure teacher/admin notification email addresses in
the admin permissions page, copy the SMTP example files to untracked secret
files, and set:

```sh
NOTIFICATION_EMAIL_ENABLED=true
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_FROM=noreply@example.com
SMTP_USERNAME_FILE=/absolute/path/to/smtp_username.txt
SMTP_PASSWORD_FILE=/absolute/path/to/smtp_password.txt
SMTP_USE_TLS=true
SMTP_USE_SSL=false
PUBLIC_BASE_URL=https://your-domain.example
```

The production Compose file mounts placeholder example secrets by default so
the channels remain disabled until their explicit `*_ENABLED` flags are set.

## Reminder scheduler

The reminder scan core is `run_reminder_scan(app)`. Production can run it with
the default lightweight thread backend or APScheduler:

```sh
REMINDER_SCAN_ENABLED=true
REMINDER_SCAN_INTERVAL=300
REMINDER_SCHEDULER_BACKEND=apscheduler
REMINDER_SCHEDULER_TIMEZONE=UTC
REMINDER_SCHEDULER_LEADER=true
```

When running more than one backend replica, keep `REMINDER_SCHEDULER_LEADER=true`
on only one instance and set `REMINDER_SCHEDULER_LEADER=false` on the others.
This prevents duplicate reminder scans. `REMINDER_SCHEDULER_BACKEND=disabled`
fully disables the scanner for worker-only or maintenance instances.

## Public HTML and search previews

The production frontend publishes its build into `frontend_bundle_prod` before
nginx starts. Flask mounts this volume **read-only**, and reads an atomic
`metadata.json` artifact containing the exact HTML template, hashed asset
references and route catalogue from that build. Rebuild/recreate both services
when upgrading this delivery mechanism; API-only development does not enable it.

Nginx serves assets, videos and uploaded files directly or through the existing
upload API. Public HTML requests go to Flask: project, award and **published**
blog details include their title, description and image before JavaScript runs.
Missing routes/details and draft articles return HTML with HTTP 404 and noindex;
an unavailable build manifest returns 503 with Retry-After. Login/member/admin
entry pages remain usable with noindex. Page bodies are still rendered by React;
this is not full server rendering.

Set `PUBLIC_BASE_URL=https://your-domain.example` before building production.
Compose also passes it as `VITE_PUBLIC_SITE_URL`, keeping browser metadata and
server canonical/share URLs consistent. Never use an untrusted request Host for
canonical URLs. Rebuild the frontend after changing this domain. The default
remains `https://304aistudio.cn` if it is not configured.

`/sitemap.xml` is generated from the public route catalogue and current public
project/award/published-blog slugs. `/robots.txt` references it. Editing or
unpublishing content affects the next server request without rebuilding. HTML
and sitemap responses use no-store; third-party social services can retain
their own cached previews. Hashed assets have a one-year cache lifetime.

The delivery volume is reproducible and contains no database or credentials;
it does not need to be backed up. The publisher retains old hashed assets for
already-open tabs. For storage cleanup, stop frontend traffic and recreate only
this delivery volume, never the DB/upload volumes, then start the frontend to
repopulate it. Multiple concurrently publishing frontend replicas are not
supported by this single-publisher Compose setup.

## Backup

The release script automatically creates and verifies a backup **before every
upgrade of an existing backend**. It briefly stops that backend to make the
SQLite database and local uploads consistent, reads its mounts read-only using
the exact previous image, and restarts it in a finally block. No Flask app or
migration runs against the backup source. Independent backup:

```sh
release=$(cat /srv/304aistudio/current-release)
python3.11 "$release/scripts/recovery.py" --project 304aistudio \
  -f "$release/compose.release.json" backup --output /srv/304aistudio/backups
```

Before the first checked release, supply the existing production Compose files
and `--env-file` instead. Always use the deployment's **actual project name**;
volume names are discovered from its backend container, not guessed.

Each private backup folder contains `database.sqlite3`, `uploads.tar.gz` and a
manifest with source image/revision, SHA-256 hashes, table counts and upload hashes. A folder without
a complete valid manifest is not a successful backup. Backups are never
overwritten. Concurrent backups to the same folder are blocked; after a crash,
inspect the process before removing its stale `.backup.lock`.

This adapter supports absolute SQLite URLs and local uploads. It does not back
up external databases or OSS bucket objects. Use provider-native backup and
restore procedures for those before enabling this release flow. Backups may
contain private data: restrict the folder to the operator and maintain a
separate protected off-server copy. Scheduled/off-server copies are not set up
by these scripts.
The existing 304aistudio installation already has a separate legacy daily
SQLite/upload backup cron. Its path, format and verification limits are recorded
in `生产更新手册.md`; it is not the manifest-based backup used by this workflow.
An existing backend with `OSS_ENABLED=true` is explicitly refused by this local
backup workflow; a provider-native release/backup procedure must be established
before deploying that storage mode.

## Restore

Every backup automatically undergoes an isolated restore rehearsal. Repeat it:

```sh
python3.11 "$release/scripts/recovery.py" --project 304aistudio \
  -f "$release/compose.release.json" rehearse \
  --backup /srv/304aistudio/backups/CHOSEN_BACKUP
```

The rehearsal container has no network, no production data mounts, a read-only
backup and temporary restore storage. It checks SQLite integrity/table counts
and every uploaded file hash. Corrupt archives, links, path traversal and
existing restore destinations are rejected. The temporary restore disappears
when the container exits; this is a data restoration check, not a full business
workflow test.

Actual incident recovery is deliberately separate: stop writers, retain the
current volumes and a fresh backup, then restore a verified bundle to a **new,
empty** volume using `backend/maintenance.py restore --source ... --destination
...`. The restored root contains `database.sqlite3` and `uploads/`; configure
the replacement backend's absolute `DATABASE_URL` and `UPLOAD_FOLDER` to those
locations, then validate its public and authenticated workflows before switching
traffic. Do not overwrite the current DB/uploads or run the old destructive
delete-and-extract commands. The scripts never automatically roll back data.
## Rotate credentials

Replace a single untracked secret file, verify its owner and permissions, then
recreate the backend. Compose secrets are re-mounted on container recreation;
do not put credentials in shell history or `.env` files.

```sh
docker compose -f docker-compose.prod.yml up -d --force-recreate backend
```

## Rollback

Checked releases keep revision-tagged backend/frontend images and separate
source directories below `releases/`. `current-release` advances only after the
server's smoke checks pass; its preceding value is saved as `previous-release`.
Keep these directories/images and verified backups until the release is stable.

For a schema-compatible rollback, read and inspect the previous release path,
then use its exact `compose.release.json` with the same project name and
`up -d --no-build --wait`. Run that release's smoke check against its recorded
revision. On the first upgrade from the legacy deployment there is no previous
pointer: retain its original Compose files; the new release directory records
the old container image IDs in `previous-backend-image.txt` and
`previous-frontend-image.txt`.
If schema compatibility is uncertain, use the separate data recovery procedure
above; changing only an image does not undo migrations or user writes.

## Checked release workflow

Local prerequisites: Node24+, Python3.12+ with `backend/requirements-dev.txt`,
Docker Compose and the existing Workbench CLI. Server prerequisites: Docker
Compose supporting `--wait`, Python3.9+, Bash, flock, tar and sha256sum.
The server script tests `python3` and versioned Python commands and uses one
compatible interpreter for every release/recovery operation. `RELEASE_PYTHON`
can explicitly select a command or absolute executable path; an unsupported
explicit selection fails without falling back. Do not replace the OS Python.

On Alibaba Cloud Linux 3, install the official `python3.11` package alongside
the system interpreter. This installation uses `/usr/bin/python3.11` (3.11.13),
while system `python3` remains 3.6.8. Read-only runtime verification:

```sh
bash scripts/deploy-remote.sh --check-runtime
# Optional explicit selection:
RELEASE_PYTHON=/usr/bin/python3.11 bash scripts/deploy-remote.sh --check-runtime
```

This runtime-only command does not validate a release, build/start containers,
back up data, or advance the release pointer. Full release gates remain required.

```powershell
# All local checks; never uploads, pushes or deploys.
powershell -ExecutionPolicy Bypass -File scripts/deploy-prod.ps1 -CheckOnly

# Explicit release action, after the complete working tree is committed.
powershell -ExecutionPolicy Bypass -File scripts/deploy-prod.ps1
```

Preflight refuses tracked/untracked changes and non-main branches, checks that
required delivery files exist in HEAD, installs the locked frontend dependencies,
runs typecheck/lint/tests/audit/build and the full backend suite, then checks the
checkout again. Ignored runtime secrets/data remain outside the archive.

The upload uses a unique archive name and verifies its SHA-256 remotely. Builds
run in a new source directory while the existing website serves traffic. Runtime
secret/certificate paths and volume names are resolved against the existing
installation; build contexts and the nginx site config use the new source.
The resolved `compose.release.json` is private and should not be shared.
Before building or stopping the existing backend, the script compares its actual
database/upload paths and backing mounts with the proposed configuration. A
different database filename, upload directory, data volume or nested mount
blocks the release. Data migration requires a separate verified procedure.

The server serializes releases with flock, builds both revision-tagged images,
backs up/rehearses existing data, starts the release with health checks and runs
HTTP smoke tests. Build errors retain their exit codes; no `tail` pipeline can
mask failure. No missing-backend situation is accepted unless `-FirstDeploy`
is supplied, and that mode also refuses pre-existing data volumes.

`/health` remains a liveness check. `/health/ready` also verifies a DB query,
the matching baked backend/frontend revisions and referenced entry assets.
Frontend production health checks use it, so an old frontend or missing bundle
cannot pass readiness merely because Gunicorn is running.

Manual read-only smoke check:

```sh
python3 scripts/release.py smoke --base-url https://304aistudio.cn \
  --revision FULL_40_CHARACTER_RELEASE_SHA --attempts 3
```

Smoke checks cover readiness/version, all 15 public pages, actual available details,
private entry noindex, true 404s, public APIs, referenced assets, sitemap and
robots. Empty public collections are reported as skipped, not invented test
content. The local wrapper repeats checks from the operator's network after
the server succeeds. A failed acceptance check stops the release process and
does not automatically restore data. Inspect release state and the verified
backup before choosing a recovery action.

## External services

OSS, OCR, and AI settings remain intentional placeholders until real provider
endpoints, models, buckets, and their corresponding secret files are supplied.
OCR reads controlled storage bytes before calling the configured provider; AI
currently acts as an OCR fallback rather than a separate product endpoint.
