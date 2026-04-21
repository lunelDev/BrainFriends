# BrainFriends 로컬 DB 백업 스크립트
#
# 사용법 (PowerShell):
#   cd C:\Users\pc\Desktop\ProjectFiles\BrainFriends
#   .\scripts\db-backup.ps1
#
# 결과:
#   data\db-backups\brainfriends_dev_YYYYMMDD_HHMMSS.sql 파일 생성
#
# 복원이 필요할 때:
#   psql -h localhost -U postgres -d brainfriends_dev -f "data\db-backups\<파일명>.sql"
#
# 주의:
#   - .env.local 의 DATABASE_URL 을 자동으로 읽어서 사용한다.
#   - 운영 DB(원격) URL 이 들어있는 줄이 주석 해제되어 있으면 그쪽으로 백업된다.
#     반드시 localhost 또는 127.0.0.1 만 백업하도록 안전 체크가 들어있다.

$ErrorActionPreference = "Stop"

# pg_dump / psql 자동 탐지 유틸 로드
. (Join-Path $PSScriptRoot "_pg-tools.ps1")

function Read-EnvLocal {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        throw ".env.local 을 찾을 수 없습니다: $Path"
    }

    $url = $null
    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if ($trimmed.StartsWith("#")) { continue }
        if ($trimmed -match "^DATABASE_URL\s*=\s*(.+)$") {
            $url = $matches[1].Trim()
            break
        }
    }

    if (-not $url) {
        throw ".env.local 에서 활성화된 DATABASE_URL 을 찾지 못했습니다."
    }
    return $url
}

function Parse-PostgresUrl {
    param([string]$Url)

    # postgresql://user:pass@host:port/db
    $regex = "^postgres(?:ql)?:\/\/([^:]+):([^@]*)@([^:\/]+)(?::(\d+))?\/([^\?]+)"
    $m = [regex]::Match($Url, $regex)
    if (-not $m.Success) {
        throw "DATABASE_URL 형식을 파싱할 수 없습니다: $Url"
    }

    return [pscustomobject]@{
        User     = [System.Uri]::UnescapeDataString($m.Groups[1].Value)
        Password = [System.Uri]::UnescapeDataString($m.Groups[2].Value)
        Host     = $m.Groups[3].Value
        Port     = if ($m.Groups[4].Value) { [int]$m.Groups[4].Value } else { 5432 }
        Database = $m.Groups[5].Value
    }
}

# ─────────────────────────────────────────────
# 실행
# ─────────────────────────────────────────────

$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath     = Join-Path $projectRoot ".env.local"
$backupDir   = Join-Path $projectRoot "data\db-backups"

if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
}

$dbUrl = Read-EnvLocal -Path $envPath
$conn  = Parse-PostgresUrl -Url $dbUrl

# 안전장치: localhost 가 아니면 거부
if ($conn.Host -notin @("localhost", "127.0.0.1", "::1")) {
    throw "이 스크립트는 로컬 DB 만 백업합니다. 현재 host: $($conn.Host) — 작업 중단."
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outFile   = Join-Path $backupDir "$($conn.Database)_$timestamp.sql"

Write-Host "■ 백업 시작" -ForegroundColor Cyan
Write-Host "  대상: $($conn.User)@$($conn.Host):$($conn.Port)/$($conn.Database)"
Write-Host "  파일: $outFile"

$pgDump = Get-PgTool -Name pg_dump
Write-Host "  pg_dump: $pgDump" -ForegroundColor DarkGray

$env:PGPASSWORD = $conn.Password
try {
    & $pgDump `
        --host=$($conn.Host) `
        --port=$($conn.Port) `
        --username=$($conn.User) `
        --no-owner `
        --no-privileges `
        --format=plain `
        --file=$outFile `
        $conn.Database

    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump 실행 실패 (exit code $LASTEXITCODE)"
    }
}
finally {
    $env:PGPASSWORD = $null
}

$size = (Get-Item $outFile).Length
Write-Host "■ 완료 — $([math]::Round($size / 1KB, 1)) KB" -ForegroundColor Green
Write-Host ""
Write-Host "복원하려면:" -ForegroundColor Yellow
Write-Host "  psql -h $($conn.Host) -U $($conn.User) -d $($conn.Database) -f `"$outFile`""
