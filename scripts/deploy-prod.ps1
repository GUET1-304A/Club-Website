#Requires -Version 5.1
<#
Deploy the current committed HEAD to the production ECS instance.

The server cannot reach GitHub, so the source is shipped as a git archive
uploaded through Alibaba Cloud Workbench CLI.

Usage:
  powershell -ExecutionPolicy Bypass -File scripts\deploy-prod.ps1
  powershell -ExecutionPolicy Bypass -File scripts\deploy-prod.ps1 -SkipPush
#>
param(
    [string]$Region = 'cn-wulanchabu',
    [string]$InstanceId = 'i-0jlhp604zk2b4ddh7683',
    [string]$RemoteDir = '/srv/304aistudio',
    [string]$Domain = 'https://304aistudio.cn',
    [switch]$SkipPush
)

$ErrorActionPreference = 'Stop'

$workbench = 'C:\Users\wy339\AppData\Local\Programs\workbench\workbench.exe'
if (-not (Test-Path -LiteralPath $workbench)) {
    throw "Workbench CLI not found: $workbench"
}

$repo = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repo

$dirty = git status --porcelain --untracked-files=no
if ($dirty) {
    throw "Working tree has uncommitted tracked changes. Commit them before deploying."
}

if (-not $SkipPush) {
    git push origin main
    if ($LASTEXITCODE -ne 0) { throw "git push failed." }
}

$archive = Join-Path $env:TEMP 'shetuanweb-src.tar.gz'
git archive --format=tar.gz -o $archive HEAD
if ($LASTEXITCODE -ne 0) { throw "git archive failed." }

Write-Host "Uploading archive..."
& $workbench upload $archive /tmp/ -i $InstanceId -r $Region -f
if ($LASTEXITCODE -ne 0) { throw "workbench upload failed." }

$remote = "cd $RemoteDir && tar xzf /tmp/shetuanweb-src.tar.gz -C $RemoteDir && " +
    "docker compose -p 304aistudio -f docker-compose.prod.yml -f docker-compose.prod.tls.yml up -d --build 2>&1 | tail -n 20"

Write-Host "Rebuilding containers..."
& $workbench exec -r $Region -i $InstanceId --timeout 900 --command $remote
if ($LASTEXITCODE -ne 0) { throw "remote rebuild failed." }

Write-Host "Verifying..."
$homeCode = & curl.exe -sS -o NUL -w "%{http_code}" "$Domain/"
$apiCode = & curl.exe -sS -o NUL -w "%{http_code}" "$Domain/api/config"
Write-Host "home=$homeCode api=$apiCode"
if ($homeCode -ne '200' -or $apiCode -ne '200') {
    throw "Verification failed. Check container logs on the server."
}

Write-Host "Deploy finished: $Domain"
