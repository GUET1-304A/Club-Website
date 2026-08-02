# Runtime baseline verification

Run the backend and container commands from the repository root.

## Local checks

Install the frontend dependencies and run its checks:

```powershell
cd frontendnew
npm ci
npm run check
npm run build
```

Run backend tests from the repository root:

```powershell
python -m pytest backend/tests -v
```

## Container checks

Create a temporary, untracked environment file containing fresh local-only
secrets. This PowerShell example copies the non-secret defaults to the system
temporary directory and generates distinct values; do not commit or reuse this
file for production:

```powershell
$runtimeEnv = Join-Path $env:TEMP "xingyu-runtime-$([guid]::NewGuid().ToString('N')).env"
Copy-Item .env.example $runtimeEnv
$secretKey = python -c "import secrets; print(secrets.token_urlsafe(48))"
$jwtSecretKey = python -c "import secrets; print(secrets.token_urlsafe(48))"
(Get-Content $runtimeEnv) -replace '^SECRET_KEY=.*$', "SECRET_KEY=$secretKey" -replace '^JWT_SECRET_KEY=.*$', "JWT_SECRET_KEY=$jwtSecretKey" | Set-Content $runtimeEnv
docker compose --env-file $runtimeEnv config
```

Expected outcome: the command exits successfully and prints the resolved Compose configuration without validation errors. It must show the backend `SECRET_KEY`, `JWT_SECRET_KEY`, database, CORS, and upload settings, with `APP_DEBUG: "false"`. `docker compose config` without `SECRET_KEY` and `JWT_SECRET_KEY` must fail.

```powershell
docker compose --env-file $runtimeEnv up --build -d
docker compose --env-file $runtimeEnv ps
curl http://localhost:5000/health
docker compose --env-file $runtimeEnv down
Remove-Item -LiteralPath $runtimeEnv
```

The frontend waits for the backend health check. The SQLite database and uploaded files use named volumes (`db_data` and `upload_data`) so they persist across container recreation.

## Environment and secrets

For local development, `.env.example` intentionally leaves the two runtime secrets blank. Copy it to an untracked `.env` or a temporary file, generate distinct high-entropy values as above, and keep it out of version control. Do not commit `.env`, real keys, tokens, or service credentials.

For production, set `FLASK_ENV=production` and `APP_DEBUG=false`, then provide unique high-entropy values for `SECRET_KEY` and `JWT_SECRET_KEY` through the deployment platform's secret manager or an uncommitted environment file. Set `DATABASE_URL`, `CORS_ORIGINS`, and `UPLOAD_FOLDER` for the production environment. The Compose file passes these values into the backend container and does not force Flask debug mode.
