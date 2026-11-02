param(
    [string]$RelayHost = '39.101.66.98',
    [int]$LocalPort = 9012,
    [string]$StateDirectory = (Join-Path (Split-Path -Parent $PSScriptRoot) '.local\relay')
)
$ErrorActionPreference = 'Stop'
$ssh = Join-Path $env:SystemRoot 'System32\OpenSSH\ssh.exe'
$key = Join-Path $StateDirectory 'id_ed25519'
$knownHosts = Join-Path $StateDirectory 'known_hosts'
if (!(Test-Path -LiteralPath $key) -or !(Test-Path -LiteralPath $knownHosts)) {
    throw 'Prepare the private key and verify the server host key before starting the relay.'
}
$mutex = [Threading.Mutex]::new($false, 'Local\304InvestmentRelay')
if (!$mutex.WaitOne(0)) { exit 0 }
try {
    while ($true) {
        # Only the dedicated server Unix socket can reach this desktop service.
        & $ssh -N -T -i $key -o BatchMode=yes -o IdentitiesOnly=yes `
            -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$knownHosts" `
            -o ServerAliveInterval=20 -o ServerAliveCountMax=3 `
            -o ConnectTimeout=10 -o ExitOnForwardFailure=yes `
            -R "/srv/304aistudio/investment-relay/relay.sock`:127.0.0.1`:$LocalPort" `
            "investment-relay@$RelayHost" 2>> (Join-Path $StateDirectory 'tunnel.log')
        Start-Sleep -Seconds 10
    }
} finally {
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
