# PostgreSQL CLI 도구(psql, pg_dump) 의 실행 경로를 자동 탐지한다.
# PATH 에 없으면 표준 설치 경로에서 찾고, 그래도 없으면 명확한 오류 메시지로 중단.
#
# 사용법 (다른 .ps1 안에서):
#   . "$PSScriptRoot\_pg-tools.ps1"
#   $psql    = Get-PgTool -Name psql
#   $pgDump  = Get-PgTool -Name pg_dump
#   & $psql --version
#
# 주의: PowerShell 은 dot-source (`. script.ps1`) 로 불러와야 함수가 호출자 스코프에 등록됨.

function Get-PgTool {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet("psql", "pg_dump", "pg_restore")]
        [string]$Name
    )

    # 1) PATH 에 있으면 그걸 쓴다
    $cmd = Get-Command "$Name.exe" -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }

    # 2) 표준 Windows 설치 경로 후보들
    $candidates = @()
    foreach ($baseEnv in @("ProgramFiles", "ProgramFiles(x86)")) {
        $base = (Get-Item "env:$baseEnv" -ErrorAction SilentlyContinue).Value
        if (-not $base) { continue }
        $pgRoot = Join-Path $base "PostgreSQL"
        if (-not (Test-Path $pgRoot)) { continue }
        # 버전별 하위 폴더 (17, 16, 15, ...) 를 내림차순으로 탐색
        $versions = Get-ChildItem -LiteralPath $pgRoot -Directory -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending
        foreach ($v in $versions) {
            $candidates += (Join-Path $v.FullName "bin\$Name.exe")
        }
    }

    # 3) EnterpriseDB 나 Scoop 같은 대체 경로 (선택적)
    $alt = @(
        "C:\PostgreSQL\bin\$Name.exe",
        "C:\tools\PostgreSQL\bin\$Name.exe"
    )
    $candidates += $alt

    foreach ($c in $candidates) {
        if (Test-Path -LiteralPath $c) {
            return $c
        }
    }

    $hint = @"
$Name 을(를) 찾을 수 없습니다.
  다음 중 하나를 수행하세요:
    1) PostgreSQL 설치 폴더의 bin 디렉터리를 Windows PATH 에 추가
       (예: C:\Program Files\PostgreSQL\17\bin)
    2) 또는 환경변수 PG_BIN_DIR 에 해당 경로를 지정
       (예: \$env:PG_BIN_DIR = "C:\Program Files\PostgreSQL\17\bin")
"@
    throw $hint
}

# PG_BIN_DIR 환경변수 지원 (최우선 순위)
if ($env:PG_BIN_DIR -and (Test-Path -LiteralPath $env:PG_BIN_DIR)) {
    if ($env:PATH -notlike "*$($env:PG_BIN_DIR)*") {
        $env:PATH = "$($env:PG_BIN_DIR);$($env:PATH)"
    }
}
