#Requires -Version 5.1
<# Deploy committed main using Workbench. -CheckOnly never uploads or deploys.
   -FirstDeploy explicitly allows an installation with no previous backend. #>
param(
    [string]$Region = 'cn-wulanchabu',
    [string]$InstanceId = 'i-0jlhp604zk2b4ddh7683',
    [string]$RemoteDir = '/srv/304aistudio',
    [string]$Domain = 'https://304aistudio.cn',
    [string]$Project = '304aistudio',
    [switch]$SkipPush,
    [switch]$CheckOnly,
    [switch]$FirstDeploy
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repo
# These values enter a POSIX command; only accept the intended syntax.
if ($RemoteDir -notmatch '^/[A-Za-z0-9_-]+(/[A-Za-z0-9_-]+)+$' -or
    $Project -notmatch '^[a-z0-9][a-z0-9_-]*$' -or
    $Domain -notmatch '^https://[A-Za-z0-9.-]+(:[0-9]+)?/?$') {
    throw 'Use an absolute remote directory, a valid Compose project, and an HTTPS origin.'
}
$token = [Guid]::NewGuid().ToString('N')
$report = Join-Path $env:TEMP "xingyu-$token.release-report.json"
& python scripts/release.py preflight --repo $repo --report $report
if ($LASTEXITCODE -ne 0) { throw 'Release preflight failed; nothing was uploaded or deployed.' }
$revision = (Get-Content -Raw -LiteralPath $report | ConvertFrom-Json).revision
if ($revision -notmatch '^[0-9a-f]{40}$') { throw 'Invalid committed revision.' }
if ($CheckOnly) { Write-Host "Preflight passed: $revision"; return }
$workbench = 'C:\Users\wy339\AppData\Local\Programs\workbench\workbench.exe'
if (-not (Test-Path -LiteralPath $workbench)) { throw "Workbench CLI not found: $workbench" }
if (-not $SkipPush) {
    & git push origin main
    if ($LASTEXITCODE -ne 0) { throw 'git push failed.' }
}
$dirty = & git status --porcelain --untracked-files=all
if ($LASTEXITCODE -ne 0 -or $dirty) { throw 'Checkout changed after preflight.' }
$archive = Join-Path $env:TEMP "xingyu-$token.tar.gz"
& git archive --format=tar.gz -o $archive $revision
if ($LASTEXITCODE -ne 0) { throw 'git archive failed.' }
$checksum = (Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToLowerInvariant()
& $workbench upload $archive /tmp/ -i $InstanceId -r $Region -f
if ($LASTEXITCODE -ne 0) { throw 'Archive upload failed.' }
$releaseDir = "$RemoteDir/releases/$revision-$token"
$remoteArchive = "/tmp/xingyu-$token.tar.gz"
$first = if ($FirstDeploy) { 'first' } else { 'existing' }
# Generated/constrained arguments; each operation must succeed before the next.
$remote = "set -eu; umask 077; printf '%s  %s\n' '$checksum' '$remoteArchive' | sha256sum -c -; " +
    "mkdir -p '$RemoteDir/releases'; mkdir '$releaseDir'; tar xzf '$remoteArchive' -C '$releaseDir'; " +
    "bash '$releaseDir/scripts/deploy-remote.sh' '$RemoteDir' '$Project' '$revision' '$Domain' '$first'"
& $workbench exec -r $Region -i $InstanceId --timeout 1800 --command $remote
if ($LASTEXITCODE -ne 0) { throw 'Remote release failed. Inspect its release directory and verified backup before recovery.' }
& python scripts/release.py smoke --base-url $Domain --revision $revision --attempts 3
if ($LASTEXITCODE -ne 0) { throw 'External smoke check failed; release is not accepted.' }
Write-Host "Release verified: $revision ($Domain)"
