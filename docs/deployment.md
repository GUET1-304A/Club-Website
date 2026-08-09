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
docker compose up -d --build
```

```bash
# Linux/macOS
SECRET_KEY=replace-with-a-long-random-string \
JWT_SECRET_KEY=replace-with-another-long-random-string \
docker compose up -d --build
```

Development mode seeds demo data (admin `admin/admin123`, demo members).
Verify with `docker compose ps`, `curl http://localhost:5000/health`, and
`curl http://localhost:3000`.

## First start

1. Copy each `secrets/*.txt.example` file to the matching untracked `.txt`
   file and replace every `REPLACE_*` value with a generated secret. Restrict
   file permissions to the deployment operator.
2. Set the seven host-file variables: `SECRET_KEY_FILE`, `JWT_SECRET_KEY_FILE`,
   `OSS_ACCESS_KEY_ID_FILE`, `OSS_ACCESS_KEY_SECRET_FILE`, `OCR_API_KEY_FILE`,
   `AI_API_KEY_FILE`, and `BOOTSTRAP_ADMIN_PASSWORD_FILE`. Set a non-secret
   `BOOTSTRAP_ADMIN_USERNAME` and the required public `CORS_ORIGINS` value.
3. Start the release with `docker compose -f docker-compose.prod.yml up -d --build`.

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

## Backup

Stop writes first, then archive both named volumes. For the default Compose
project name, for example:

```sh
docker compose -f docker-compose.prod.yml stop backend
docker run --rm -v final-prompt_db_data_prod:/data -v "$PWD/backups:/backup" alpine tar czf /backup/db-data.tgz -C /data .
docker run --rm -v final-prompt_upload_data_prod:/data -v "$PWD/backups:/backup" alpine tar czf /backup/uploads.tgz -C /data .
```

## Restore

Stop the stack, retain a copy of the current volumes, then extract trusted
archives into the matching volumes and restart the stack:

```sh
docker compose -f docker-compose.prod.yml down
docker run --rm -v final-prompt_db_data_prod:/data -v "$PWD/backups:/backup" alpine sh -c 'rm -rf /data/* && tar xzf /backup/db-data.tgz -C /data'
docker run --rm -v final-prompt_upload_data_prod:/data -v "$PWD/backups:/backup" alpine sh -c 'rm -rf /data/* && tar xzf /backup/uploads.tgz -C /data'
docker compose -f docker-compose.prod.yml up -d
```

## Rotate credentials

Replace a single untracked secret file, verify its owner and permissions, then
recreate the backend. Compose secrets are re-mounted on container recreation;
do not put credentials in shell history or `.env` files.

```sh
docker compose -f docker-compose.prod.yml up -d --force-recreate backend
```

## Rollback

Keep a known-good source revision and backup before an upgrade. Check out that
revision (or use an approved immutable image tag), then run the same Compose
command with `up -d --build`. Restore the volume backup if the release changed
data incompatibly.

## External services

OSS, OCR, and AI settings remain intentional placeholders until real provider
endpoints, models, buckets, and their corresponding secret files are supplied.
OCR reads controlled storage bytes before calling the configured provider; AI
currently acts as an OCR fallback rather than a separate product endpoint.
