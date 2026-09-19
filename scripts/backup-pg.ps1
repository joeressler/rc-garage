# Purpose: Windows companion for scripts/backup-pg.sh using the compose rc-db service.
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$envFile = Join-Path $repoRoot '.env'
$pgUser = 'rc_garage_admin'
$pgDb = 'rc_garage_prod'
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*POSTGRES_USER=(.+)$') { $pgUser = $Matches[1].Trim() }
    if ($_ -match '^\s*POSTGRES_DB=(.+)$') { $pgDb = $Matches[1].Trim() }
  }
}

New-Item -ItemType Directory -Force -Path (Join-Path $repoRoot 'backups') | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd'
$outRel = "backups\rc-garage-$stamp.sql"
cmd.exe /c "docker compose exec -T rc-db pg_dump -U $pgUser $pgDb > $outRel"
Write-Host "Wrote $outRel"
