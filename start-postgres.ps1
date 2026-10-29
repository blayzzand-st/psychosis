$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$pgRuntime = (Get-Content (Join-Path $projectRoot '.local\postgres-runtime.txt') -Raw).Trim()
$pgBin = Join-Path $pgRuntime 'postgres\pgsql\bin'
$pgData = Join-Path $pgRuntime 'pgdata'
& "$pgBin\pg_ctl.exe" status -D $pgData *> $null
if ($LASTEXITCODE -ne 0) {
    & "$pgBin\pg_ctl.exe" start -D $pgData -l (Join-Path $pgRuntime 'postgres.log') -w
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL failed to start' }
}
Write-Host 'PostgreSQL: 127.0.0.1:5432'
