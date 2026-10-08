param([int]$BackendPort = 8000, [int]$FrontendPort = 5173)
$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$backendRoot = Join-Path $projectRoot 'backend'
$runtimeRoot = Join-Path $backendRoot '.runtime'
New-Item -ItemType Directory -Force $runtimeRoot | Out-Null
function Read-BackendHealth {
    try { Invoke-RestMethod "http://127.0.0.1:$BackendPort/api/health" -TimeoutSec 3 } catch { $null }
}
function Test-LocalPort([int]$Port) {
    $probe = [Net.Sockets.TcpClient]::new()
    try { $probe.Connect('127.0.0.1', $Port); return $true } catch { return $false } finally { $probe.Dispose() }
}
$digest = [Security.Cryptography.SHA256]::Create()
$instance = ([BitConverter]::ToString($digest.ComputeHash([Text.Encoding]::UTF8.GetBytes($backendRoot)))).Replace('-', '').ToLower().Substring(0,16)
$digest.Dispose()
$existing = Read-BackendHealth
if (Test-LocalPort $BackendPort) {
    netstat -ano -p TCP | Select-String 'LISTENING' | Select-String ":$BackendPort\s"
    if (-not $existing -or $existing.backend_instance -ne $instance -or -not $existing.persistent -or $existing.status -ne 'ok') {
        throw "Port $BackendPort belongs to another or unhealthy instance. No process was stopped. Inspect it or use -BackendPort 8001."
    }
    Write-Host "Reusing healthy persistent backend on port $BackendPort."
} else {
    $config = Get-Content (Join-Path $backendRoot '.env') -ErrorAction SilentlyContinue
    $uri = ($config | Where-Object { $_ -match '^MONGODB_URI=' } | Select-Object -First 1) -replace '^MONGODB_URI=', ''
    if ($env:MONGODB_URI) { $uri = $env:MONGODB_URI }
    if (-not $uri) { $uri = 'mongodb://localhost:27017' }
    if ($uri -match '^mongodb://(localhost|127\.0\.0\.1):27017/?$' -and -not (Test-LocalPort 27017)) {
        $mongo = Get-ChildItem $runtimeRoot -Filter mongod.exe -Recurse | Select-Object -First 1
        if (-not $mongo) { throw 'MongoDB is not running. Start your MongoDB service or configure MONGODB_URI.' }
        $dataPath = Join-Path $runtimeRoot 'data'
        $logPath = Join-Path $runtimeRoot 'mongod.log'
        New-Item -ItemType Directory -Force $dataPath | Out-Null
        $mongoProcess = Start-Process $mongo.FullName -ArgumentList @('--dbpath', ('"' + $dataPath + '"'), '--logpath', ('"' + $logPath + '"'), '--logappend', '--bind_ip', '127.0.0.1', '--port', '27017') -WindowStyle Hidden -PassThru
        $mongoProcess.Id | Set-Content (Join-Path $runtimeRoot 'mongod.pid')
        for ($attempt = 0; $attempt -lt 30 -and -not (Test-LocalPort 27017); $attempt++) { Start-Sleep -Milliseconds 500 }
        if (-not (Test-LocalPort 27017)) { throw "MongoDB did not start. Inspect $logPath" }
    }
    $pythonPath = Join-Path $backendRoot '.venv/Scripts/python.exe'
    $backendProcess = Start-Process $pythonPath -ArgumentList @('start.py', '--port', $BackendPort) -WorkingDirectory $backendRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeRoot 'backend.stdout.log') -RedirectStandardError (Join-Path $runtimeRoot 'backend.stderr.log') -PassThru
    $backendProcess.Id | Set-Content (Join-Path $runtimeRoot 'backend.pid')
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 500
        $existing = Read-BackendHealth
        if ($existing) { break }
        if ($backendProcess.HasExited) { break }
    }
    if (-not $existing -or $existing.backend_instance -ne $instance -or -not $existing.persistent) { throw "Backend startup failed. Inspect $runtimeRoot/backend.stderr.log" }
    Write-Host "Backend ready with real persistent MongoDB on port $BackendPort."
}
if (Test-LocalPort $FrontendPort) {
    try { $frontendHealth = Invoke-RestMethod "http://127.0.0.1:$FrontendPort/api/health" -TimeoutSec 3 } catch { $frontendHealth = $null }
    if (-not $frontendHealth -or $frontendHealth.backend_instance -ne $instance) { throw "Frontend port $FrontendPort is occupied by another app. No process was stopped." }
    Write-Host 'Reusing the connected frontend.'
} else {
    $oldProxy = $env:BACKEND_PROXY_TARGET
    try {
        $env:BACKEND_PROXY_TARGET = "http://127.0.0.1:$BackendPort"
        $nodePath = (Get-Command node.exe).Source
        $frontendProcess = Start-Process $nodePath -ArgumentList @('node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', $FrontendPort, '--strictPort') -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeRoot 'frontend.stdout.log') -RedirectStandardError (Join-Path $runtimeRoot 'frontend.stderr.log') -PassThru
        $frontendProcess.Id | Set-Content (Join-Path $runtimeRoot 'frontend.pid')
        for ($attempt = 0; $attempt -lt 30 -and -not (Test-LocalPort $FrontendPort); $attempt++) { Start-Sleep -Milliseconds 500 }
        if (-not (Test-LocalPort $FrontendPort)) { throw 'Frontend failed to start. Inspect frontend.stderr.log.' }
    } finally { $env:BACKEND_PROXY_TARGET = $oldProxy }
}
Write-Host "Frontend: http://127.0.0.1:$FrontendPort | API docs: http://127.0.0.1:$BackendPort/docs"
