# Production Deployment Design

## Goal

Provide a production Docker deployment that does not expose source mounts or
secret values in Compose environment inspection, while preserving the existing
local development Compose workflow and the OSS/OCR/AI integrations.

## Approved approach

Use Docker Compose file secrets (the previously selected方案一) for secret
values. The backend accepts both direct environment variables for development
and an adjacent `*_FILE` variable for production. Direct non-empty values take
precedence so existing developer workflows remain compatible; otherwise the
configured file is read as UTF-8 with its final line ending removed.

The sensitive settings are `SECRET_KEY`, `JWT_SECRET_KEY`,
`OSS_ACCESS_KEY_ID`, `OSS_ACCESS_KEY_SECRET`, `OCR_API_KEY`, and `AI_API_KEY`.
Unreadable secret files fail startup instead of silently falling back to an
insecure default.

## Runtime topology

`docker-compose.prod.yml` contains a private Flask backend and an Nginx
frontend. Nginx serves the built React bundle, proxies `/api/` and `/uploads/`
to the backend, and is the only HTTP(S) service published on the host. SQLite
data and local uploads use named volumes. OSS is enabled only when all required
non-secret endpoint/bucket settings plus mounted access-key secrets are set.

The production frontend image is built by a new multistage Dockerfile and
receives an empty `VITE_BACKEND_URL` so browser requests use same-origin `/api`.
TLS certificates are externally mounted at `/etc/nginx/certs` and a separate
TLS Nginx include is enabled only by the operator after certificates exist.

## Operator assets

`secrets/*.txt.example` contains no credentials and documents the six expected
files. `secrets/` is ignored. The deployment guide covers first start,
backup/restore of both named volumes, credential rotation, health checks,
rollback to the prior image/tag, and the current limitation that AI is an OCR
fallback configuration rather than a standalone business endpoint.

## Validation

Unit tests prove `*_FILE` loading, direct-value precedence, and startup failure
for an unreadable selected secret file. Compose rendering is validated with
only disposable command-line values for its required non-secret configuration;
it must show secret mounts and no secret values in the backend environment.
The existing backend test suite plus frontend type/lint and production build
remain required checks.

## Release hardening

The build context excludes all runtime state before `COPY backend/ .`: in
particular `backend/uploads/`, `backend/xingyu_cms.db`, `**/.env`, untracked
`secrets/*.txt`, and `deploy/certs/*.pem`. This prevents Docker image layers
and named-volume initialization from inheriting local databases, uploads, or
credentials.

`SEED_DEMO_DATA` remains enabled outside production. `ProductionConfig` sets
it to false and requires `BOOTSTRAP_ADMIN_USERNAME` plus the seventh file
secret, `bootstrap_admin_password`, exposed to Flask as
`BOOTSTRAP_ADMIN_PASSWORD_FILE`. The bootstrap administrator is created only
for an empty production database; no `admin/admin123` or demonstration
members, projects, awards, posts, or notifications are written in production.

TLS is an explicit `docker-compose.prod.tls.yml` override. It retains the
port-80 redirect, publishes 443, and mounts both `deploy/nginx/tls.conf` and
issuer certificates read-only. The HTTP and TLS Nginx servers send baseline
security headers; the TLS server additionally sends
`Strict-Transport-Security`.
