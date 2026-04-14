$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $projectRoot 'backend'
$pythonExe = Join-Path $projectRoot '.venv\Scripts\python.exe'
$port = 8000

if (-not (Test-Path $pythonExe)) {
    Write-Error "Python interpreter not found at $pythonExe"
    exit 1
}

# Stop any process currently listening on Django's port.
$listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
foreach ($listener in $listeners) {
    try {
        Stop-Process -Id $listener.OwningProcess -Force -ErrorAction Stop
        Write-Host "Stopped process on port $port (PID $($listener.OwningProcess))."
    }
    catch {
        Write-Warning "Could not stop PID $($listener.OwningProcess): $($_.Exception.Message)"
    }
}

Set-Location $backendDir
Write-Host "Starting Django on http://127.0.0.1:$port ..."
& $pythonExe manage.py runserver 127.0.0.1:$port --noreload
