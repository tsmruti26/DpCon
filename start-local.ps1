$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$aiDirectory = Join-Path $root 'ai-service'
$secretsPath = Join-Path $root '.local-secrets.json'
$venvPython = Join-Path $aiDirectory '.venv\Scripts\python.exe'
$python = if (Test-Path -LiteralPath $venvPython) { $venvPython } else { 'python' }

# Both the local H2 database and the AI listener are single-instance resources.
# Detect stale/duplicate app launches before starting a second backend against
# the same dpdp_db.mv.db file (H2 embedded mode locks that file exclusively).
foreach ($port in @(8080, 8001)) {
    $listener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($listener) {
        $owner = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
        $ownerName = if ($owner) { $owner.ProcessName } else { 'unknown process' }
        throw "Port $port is already in use by $ownerName (PID $($listener.OwningProcess)). Stop the existing DpCon service with Ctrl+C in its original terminal, then rerun start-local.ps1. This prevents a second backend from colliding with the file-backed H2 database."
    }
}

# Keep generated local secrets stable across restarts so saved browser sessions
# remain valid. This local-only file is ignored by Git; production uses explicit env vars.
if (-not (Test-Path -LiteralPath $secretsPath)) {
    $localSecrets = @{
        jwtSecret = [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
        aiServiceToken = [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
    }
    $localSecrets | ConvertTo-Json | Set-Content -LiteralPath $secretsPath -Encoding ascii
}
$localSecrets = Get-Content -LiteralPath $secretsPath -Raw | ConvertFrom-Json
if ($localSecrets.jwtSecret.Length -lt 32 -or $localSecrets.aiServiceToken.Length -lt 32) {
    throw "Local secrets in $secretsPath are invalid. Delete that file and run this script again."
}
$env:JWT_SECRET = $localSecrets.jwtSecret
$env:AI_SERVICE_TOKEN = $localSecrets.aiServiceToken
$env:AI_SERVICE_URL = 'http://127.0.0.1:8001'
$env:PORT = '8001'
$env:HOST = '127.0.0.1'

$aiProcess = $null
try {
    $aiProcess = Start-Process -FilePath $python `
        -ArgumentList @((Join-Path $aiDirectory 'main.py')) `
        -WorkingDirectory $aiDirectory `
        -WindowStyle Hidden `
        -PassThru

    $aiReady = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if ($aiProcess.HasExited) {
            throw "AI service exited during startup (code $($aiProcess.ExitCode)). Check the ai-service dependencies."
        }
        try {
            $null = Invoke-RestMethod -Uri 'http://127.0.0.1:8001/' -TimeoutSec 2
            $aiReady = $true
            break
        } catch {
            Start-Sleep -Seconds 1
        }
    }
    if (-not $aiReady) {
        throw 'AI service did not become ready on port 8001.'
    }

    Write-Host 'AI service ready on http://127.0.0.1:8001'
    Write-Host 'Starting backend on http://127.0.0.1:8080 (Ctrl+C to stop).'
    & (Join-Path $root 'mvnw.cmd') spring-boot:run
    if ($LASTEXITCODE -ne 0) {
        throw "Backend exited with code $LASTEXITCODE."
    }
} finally {
    if ($aiProcess -and -not $aiProcess.HasExited) {
        Stop-Process -Id $aiProcess.Id -Force -ErrorAction SilentlyContinue
    }
}
