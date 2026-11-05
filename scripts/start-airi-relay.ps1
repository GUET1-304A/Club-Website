param(
    [string]$RelayHost = '39.101.66.98',
    [int]$LocalPort = 4176,
    [string]$StateDirectory = (Join-Path (Split-Path -Parent $PSScriptRoot) '.local\airi-demo')
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$ssh = Join-Path $env:SystemRoot 'System32\OpenSSH\ssh.exe'
$node = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$key = Join-Path $StateDirectory 'id_ed25519'
$knownHosts = Join-Path $StateDirectory 'known_hosts'
$config = Join-Path $StateDirectory 'gateway.json'
foreach ($file in @($node, $key, $knownHosts, $config)) {
    if (!(Test-Path -LiteralPath $file)) { throw "Missing private AIRI relay asset: $file" }
}
$mutex = [Threading.Mutex]::new($false, 'Local\304AiriRelay')
if (!$mutex.WaitOne(0)) { exit 0 }
$gateway = $null
$tunnel = $null
try {
    while ($true) {
        if (!$gateway -or $gateway.HasExited) {
            $gateway = Start-Process -FilePath $node -ArgumentList @(
                ('"' + (Join-Path $PSScriptRoot 'airi-demo-gateway.mjs') + '"'),
                ('"' + $config + '"')
            ) -WorkingDirectory $repo -WindowStyle Hidden -PassThru `
                -RedirectStandardOutput (Join-Path $StateDirectory 'gateway.log') `
                -RedirectStandardError (Join-Path $StateDirectory 'gateway-error.log')
            Start-Sleep -Seconds 2
            if ($gateway.HasExited) { throw 'AIRI demo gateway exited. Read its private error log.' }
        }
        $tunnel = Start-Process -FilePath $ssh -ArgumentList @(
            '-N', '-T', '-i', ('"' + $key + '"'), '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes',
            '-o', 'StrictHostKeyChecking=yes', '-o', ('"UserKnownHostsFile=' + $knownHosts + '"'),
            '-o', 'ServerAliveInterval=20', '-o', 'ServerAliveCountMax=3',
            '-o', 'ConnectTimeout=10', '-o', 'ExitOnForwardFailure=yes',
            '-R', "/srv/304aistudio/airi-relay/relay.sock`:127.0.0.1`:$LocalPort", "airi-relay@$RelayHost"
        ) -WindowStyle Hidden -PassThru -RedirectStandardError (Join-Path $StateDirectory 'tunnel.log')
        while (!$tunnel.HasExited -and !$gateway.HasExited) { Start-Sleep -Seconds 2 }
        if (!$tunnel.HasExited) { $tunnel.Kill() }
        Start-Sleep -Seconds 10
    }
} finally {
    if ($tunnel -and !$tunnel.HasExited) { $tunnel.Kill() }
    if ($gateway -and !$gateway.HasExited) { $gateway.Kill() }
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
