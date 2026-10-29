$ErrorActionPreference = 'Stop'
$pgRuntime = (Get-Content "$PSScriptRoot\.local\postgres-runtime.txt" -Raw).Trim()
& "$pgRuntime\postgres\pgsql\bin\pg_ctl.exe" stop -D "$pgRuntime\pgdata" -m fast -w
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL failed to stop' }
