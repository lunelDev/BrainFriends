# BrainFriends voice-analysis-service
# Parselmouth (Praat) 기반 음향 분석 FastAPI.
# 포트 8001 — Next.js 의 VOICE_ANALYSIS_URL 기본값과 일치.

FROM python:3.11-slim

# ffmpeg: webm/mp4/m4a/mp3 컨테이너 디코딩에 필수.
# libsndfile1: soundfile 백엔드.
# build-essential: 일부 휠이 없는 환경에서의 fallback 빌드.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ffmpeg \
        libsndfile1 \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY main.py analyzer.py ./

EXPOSE 8001

# 컨테이너 헬스체크 — /healthz 200 OK.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request,sys; \
sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8001/healthz').status == 200 else 1)" \
    || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
