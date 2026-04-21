# BrainFriends 통일 스키마를 로컬 DB 에 적용
#
# 사용법 (PowerShell):
#   cd C:\Users\pc\Desktop\ProjectFiles\BrainFriends
#   .\scripts\db-apply-unified-schema.ps1
#
# 동작:
#   docs\database\account-onboarding-redesign.sql 를 로컬 DB 에 실행한다.
#   기존 레거시 테이블은 전혀 건드리지 않고,
#   신규 테이블과 추가 컬럼만 idempotent 하게 생성한다.
#   여러 번 실행해도 안전.
#
# 안전장치:
#   - localhost 가 아니면 실행 거부
#   - 실행 전 자동으로 db-backup.ps1 을 1회 수행
#   - 실패 시 오류 메시지와 백업 파일 경로 출력

$ErrorActionPreference = "Stop"

# psql / pg_dump 자동 탐지 유틸 로드 (PATH 에 없을 때 대비)
. (Join-Path $PSScriptRoot "_pg-tools.ps1")

$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath     = Join-Path $projectRoot ".env.local"
$sqlPath     = Join-Path $projectRoot "docs\database\account-onboarding-redesign.sql"
$backupScript = Join-Path $projectRoot "scripts\db-backup.ps1"

if (-not (Test-Path $sqlPath)) {
    throw "SQL 파일을 찾을 수 없습니다: $sqlPath"
}

# ── env 읽기 (db-backup.ps1 과 동일 로직 소형 복제) ──
$dbUrl = $null
foreach ($line in Get-Content -LiteralPath $envPath) {
    $trimmed = $line.Trim()
    if ($trimmed.StartsWith("#")) { continue }
    if ($trimmed -match "^DATABASE_URL\s*=\s*(.+)$") {
        $dbUrl = $matches[1].Trim()
        break
    }
}
if (-not $dbUrl) { throw ".env.local 에서 DATABASE_URL 을 찾지 못함" }

$m = [regex]::Match($dbUrl, "^postgres(?:ql)?:\/\/([^:]+):([^@]*)@([^:\/]+)(?::(\d+))?\/([^\?]+)")
if (-not $m.Success) { throw "DATABASE_URL 파싱 실패" }

$user = [System.Uri]::UnescapeDataString($m.Groups[1].Value)
$pass = [System.Uri]::UnescapeDataString($m.Groups[2].Value)
$host_ = $m.Groups[3].Value
$port = if ($m.Groups[4].Value) { [int]$m.Groups[4].Value } else { 5432 }
$db   = $m.Groups[5].Value

if ($host_ -notin @("localhost", "127.0.0.1", "::1")) {
    throw "로컬 DB 가 아닙니다. 현재 host: $host_ — 작업 중단."
}

# ── 1. 백업 선행 ──
Write-Host "■ 적용 전 자동 백업" -ForegroundColor Cyan
& $backupScript
if ($LASTEXITCODE -ne 0) { throw "백업 실패로 중단" }

# ── 2. SQL 실행 ──
Write-Host ""
Write-Host "■ 통일 스키마 적용: $sqlPath" -ForegroundColor Cyan
$psql = Get-PgTool -Name psql
Write-Host "  psql: $psql" -ForegroundColor DarkGray
$env:PGPASSWORD = $pass
try {
    & $psql `
        --host=$host_ `
        --port=$port `
        --username=$user `
        --dbname=$db `
        --set=ON_ERROR_STOP=1 `
        --file=$sqlPath

    if ($LASTEXITCODE -ne 0) {
        throw "psql 실행 실패 (exit code $LASTEXITCODE). 위 메시지를 확인하고, 필요 시 백업 파일로 복원하세요."
    }
}
finally {
    $env:PGPASSWORD = $null
}

Write-Host ""
Write-Host "■ 적용 완료" -ForegroundColor Green
Write-Host "  신규 테이블: users, user_pii_profile, therapist_profiles,"
Write-Host "              institutions, institution_members, user_therapist_mappings,"
Write-Host "              clinical_patient_profiles"
Write-Host "  확인: psql -h $host_ -U $user -d $db -c \"\\dt\""
