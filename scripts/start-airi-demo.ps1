param([string]$AiriWorkspace = 'F:\codex\数字生命')
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$state = Join-Path $repo '.local\airi-demo'
. (Join-Path $AiriWorkspace 'scripts\airi-env.ps1')
$preview = $null
function Test-AiriPreview {
    try {
        $page = Invoke-WebRequest 'http://127.0.0.1:4173/' -UseBasicParsing -TimeoutSec 3
        return $page.StatusCode -eq 200 -and $page.Content -match '<title>\s*AIRI\s*</title>' -and $page.Content -notmatch '/@vite/client'
    } catch { return $false }
}
$mutex = [Threading.Mutex]::new($false, 'Local\304AiriDemo')
if (!$mutex.WaitOne(0)) { exit 0 }
try {
    if (!(Test-AiriPreview)) {
        $probe = [Net.Sockets.TcpClient]::new()
        try { $occupied = $probe.ConnectAsync('127.0.0.1', 4173).Wait(1000) -and $probe.Connected }
        catch { $occupied = $false }
        finally { $probe.Dispose() }
        if ($occupied) { throw 'Port 4173 belongs to another service or a development server. Preserve it and resolve the conflict.' }
        $preview = Start-Process -FilePath $AiriNode -ArgumentList @(
            ('"' + $AiriPnpm + '"'), '--filter', '@proj-airi/stage-web', 'exec', 'vite', 'preview',
            '--host', '127.0.0.1', '--port', '4173', '--strictPort'
        ) -WorkingDirectory $AiriRepo -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput (Join-Path $state 'preview.log') `
            -RedirectStandardError (Join-Path $state 'preview-error.log')
        for ($attempt = 0; $attempt -lt 60; $attempt++) {
            if (Test-AiriPreview) { break }
            if ($preview.HasExited) { throw 'AIRI production preview exited. Read its private error log.' }
            Start-Sleep -Seconds 1
        }
        if (!(Test-AiriPreview)) { throw 'AIRI production preview did not become ready.' }
    }
    & (Join-Path $PSScriptRoot 'start-airi-relay.ps1')
} finally {
    # Only the launcher created by this script is eligible for termination.
    if ($preview -and !$preview.HasExited) { & taskkill.exe /PID $preview.Id /T /F 2>$null | Out-Null }
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
