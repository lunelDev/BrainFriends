$ErrorActionPreference = "Stop"

function Get-EnvValue {
  param(
    [Parameter(Mandatory = $true)][string]$Content,
    [Parameter(Mandatory = $true)][string]$Key
  )

  $pattern = "(?m)^\s*$Key\s*=\s*(.+?)\s*$"
  $match = [regex]::Match($Content, $pattern)
  if (-not $match.Success) {
    throw "Missing '$Key' in env content."
  }

  $value = $match.Groups[1].Value.Trim()
  if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
    return $value.Substring(1, $value.Length - 2)
  }

  return $value
}

function Require-File {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (-not (Test-Path $Path)) {
    throw "Required file not found: $Path"
  }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $repoRoot ".env.local"
Require-File -Path $envPath

$envContent = Get-Content $envPath -Raw
$localDatabaseUrl = Get-EnvValue -Content $envContent -Key "DATABASE_URL"

$psqlPath = "C:\Program Files\PostgreSQL\17\bin\psql.exe"
$dumpPath = Join-Path $env:TEMP ("brainfriends-prod-sync-" + [guid]::NewGuid().ToString("N") + ".sql")
$serverHost = "root@223.130.147.97"
$serverRepo = "~/BrainFriends"

Require-File -Path $psqlPath

Write-Host "[1/3] Dumping production DB from $serverHost ..." -ForegroundColor Cyan

$remoteDumpCommand = @'
set -e
cd ~/BrainFriends
set -a
. ./.env
set +a
pg_dump "$DATABASE_URL" --clean --if-exists --no-owner --no-privileges --quote-all-identifiers
'@

& ssh $serverHost "bash -lc '$remoteDumpCommand'" | Out-File -FilePath $dumpPath -Encoding utf8

if (-not (Test-Path $dumpPath) -or ((Get-Item $dumpPath).Length -eq 0)) {
  throw "Production dump failed or produced an empty file."
}

Write-Host "[2/3] Restoring into local DB from .env.local ..." -ForegroundColor Cyan

& $psqlPath $localDatabaseUrl -v ON_ERROR_STOP=1 -f $dumpPath

Write-Host "[3/3] Local DB now matches production snapshot." -ForegroundColor Green
Write-Host "Dump file: $dumpPath" -ForegroundColor DarkGray
