# BrainFriends voice-analysis-service - 로컬 실행 (Windows PowerShell).
#
# 사전: ffmpeg 설치 필요.
#   choco install ffmpeg
#   또는 scoop install ffmpeg
#
# 사용:
#   .\run.ps1
#   $env:PORT=9001; .\run.ps1

$ErrorActionPreference = "Stop"

Set-Location -Path $PSScriptRoot

$VenvDir = ".venv"
$PythonBin = if ($env:PYTHON_BIN) { $env:PYTHON_BIN } else { "python" }
$Port = if ($env:PORT) { $env:PORT } else { "8001" }
$HostName = if ($env:HOST) { $env:HOST } else { "127.0.0.1" }

# ── ffmpeg 사전 체크 ─────────────────────────────────────────────
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Error @"
ffmpeg 가 설치되어 있지 않습니다.
  choco install ffmpeg
  또는 scoop install ffmpeg
"@
    exit 1
}

# ── venv 생성/활성화 ────────────────────────────────────────────
if (-not (Test-Path $VenvDir)) {
    Write-Host "[run.ps1] 가상환경 생성: $VenvDir"
    & $PythonBin -m venv $VenvDir
}

$Activate = Join-Path $VenvDir "Scripts\Activate.ps1"
. $Activate

# ── 의존성 설치 ─────────────────────────────────────────────────
python -m pip install --upgrade pip | Out-Null
pip install -r requirements.txt

# ── uvicorn 실행 ────────────────────────────────────────────────
Write-Host "[run.ps1] uvicorn 시작 -> http://${HostName}:${Port}"
uvicorn main:app --host $HostName --port $Port --reload
