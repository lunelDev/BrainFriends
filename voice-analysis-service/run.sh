#!/usr/bin/env bash
# BrainFriends voice-analysis-service — 로컬 실행 (macOS / Linux / WSL).
#
# 사전: ffmpeg 설치 필요.
#   macOS:  brew install ffmpeg
#   Ubuntu: sudo apt-get install -y ffmpeg
#   WSL:    sudo apt-get install -y ffmpeg
#
# 사용:
#   ./run.sh           # 8001 포트로 띄움
#   PORT=9001 ./run.sh # 포트 변경

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

VENV_DIR=".venv"
PYTHON_BIN="${PYTHON_BIN:-python3}"
PORT="${PORT:-8001}"
HOST="${HOST:-127.0.0.1}"

# ── ffmpeg 사전 체크 ─────────────────────────────────────────────
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "[run.sh] ffmpeg 가 설치되어 있지 않습니다." >&2
  echo "  macOS:  brew install ffmpeg" >&2
  echo "  Ubuntu: sudo apt-get install -y ffmpeg" >&2
  exit 1
fi

# ── venv 생성/활성화 ────────────────────────────────────────────
if [ ! -d "$VENV_DIR" ]; then
  echo "[run.sh] 가상환경 생성: $VENV_DIR"
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi

# shellcheck source=/dev/null
. "$VENV_DIR/bin/activate"

# ── 의존성 설치 ─────────────────────────────────────────────────
pip install --upgrade pip >/dev/null
pip install -r requirements.txt

# ── uvicorn 실행 ────────────────────────────────────────────────
echo "[run.sh] uvicorn 시작 → http://$HOST:$PORT"
exec uvicorn main:app --host "$HOST" --port "$PORT" --reload
