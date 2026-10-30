param([string]$Isu = '368833', [switch]$TrustCa)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$python = Join-Path $root 'backend/.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $python)) { throw 'Install backend dependencies first (backend/README.md).' }
Push-Location $root
try {
    if (-not (Test-Path -LiteralPath '.local/tls/server.crt')) {
        & $python scripts/init_tls.py --isu $Isu
        if ($LASTEXITCODE -ne 0) { throw 'Certificate generation failed.' }
    }
    if ($TrustCa) {
        Import-Certificate -FilePath .local/tls/ca.crt -CertStoreLocation Cert:\CurrentUser\Root | Out-Null
    }
    docker compose stop frontend backend
    if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop first.' }
    docker compose -f compose.yaml -f compose.local.yaml up -d --wait db
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL startup failed.' }
    $stateFile = Join-Path $root '.local/local-processes.json'
    if (Test-Path -LiteralPath $stateFile) {
        $state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
        $processes = @(Get-CimInstance Win32_Process)
        foreach ($processId in @($state.backend, $state.frontend)) {
            $process = $processes | Where-Object ProcessId -EQ $processId
            if ($process -and ($process.CommandLine -match 'uvicorn app\.main:app|-m app\.serve|node_modules/vite/bin/vite\.js')) {
                $descendants = @($process)
                for ($index = 0; $index -lt $descendants.Count; $index++) {
                    $parentId = $descendants[$index].ProcessId
                    $descendants += @($processes | Where-Object ParentProcessId -EQ $parentId)
                }
                [array]::Reverse($descendants)
                $descendants | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
            }
        }
    }
    $env:API_RELOAD = '1'
    $env:API_HOST = '127.0.0.1'
    $env:TLS_DIR = Join-Path $root '.local/tls'
    $backendProcess = Start-Process -FilePath $python -ArgumentList '-m app.serve' -WorkingDirectory "$root/backend" -WindowStyle Hidden -PassThru -RedirectStandardOutput "$root/.local/backend-local.out.log" -RedirectStandardError "$root/.local/backend-local.err.log"
    $frontendProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList 'node_modules/vite/bin/vite.js' -WorkingDirectory "$root/frontend" -WindowStyle Hidden -PassThru -RedirectStandardOutput "$root/.local/frontend-local.out.log" -RedirectStandardError "$root/.local/frontend-local.err.log"
    @{ backend = $backendProcess.Id; frontend = $frontendProcess.Id } | ConvertTo-Json | Set-Content -LiteralPath $stateFile
    Write-Output 'Frontend: https://localhost:5173   API: https://localhost:8000/docs'
} finally { Pop-Location }
