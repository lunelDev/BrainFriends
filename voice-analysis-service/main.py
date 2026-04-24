"""voice-analysis-service / main.py

BrainFriends 음향 분석용 FastAPI 서버.

Next.js 의 `src/app/api/proxy/voice-analysis/route.ts` 가 호출하는 업스트림으로,
환경변수 `VOICE_ANALYSIS_URL` 의 기본값 `http://127.0.0.1:8001` 와 동일한 포트로
띄워져 있어야 한다.

응답 계약은 프록시 라우트의 `AcousticResponse` 타입과 1:1 로 일치한다.
산출 지표 정의: docs/remediation/01-sw-vnv/parselmouth-requirements.md
(REQ-ACOUSTIC-001~031, 050)
"""

from __future__ import annotations

import sys
from typing import Optional

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from analyzer import (
    AcousticAnalysisError,
    AudioDecodeError,
    NULL_RESULT,
    analyze_audio,
    version_snapshot,
)


app = FastAPI(
    title="BrainFriends Voice Analysis",
    version="0.1.0",
    description=(
        "Parselmouth 기반 음향 분석 마이크로서비스. "
        "BrainFriends Next.js 앱의 /api/proxy/voice-analysis 프록시가 호출한다."
    ),
)

# CORS — 개발 단계에서는 모든 origin 허용. 운영 시 도메인을 좁혀야 함.
# (프록시 경유가 정상 경로이므로 보통 server-to-server 호출이지만,
#  브라우저 직접 호출 시나리오도 일단 열어둔다.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _fallback_payload(reason: str) -> dict:
    """Next.js 프록시의 makeFallback() 와 같은 형태."""
    return {
        "ok": True,  # 프록시 측에서 ok=true + fallback=true 패턴을 따른다.
        "result": NULL_RESULT,
        "version_snapshot": None,
        "fallback": True,
        "reason": reason,
    }


@app.get("/healthz")
def healthz() -> dict:
    """헬스체크 — 컨테이너/오케스트레이터에서 사용."""
    return {"ok": True, "service": "voice-analysis"}


@app.get("/version")
def version() -> dict:
    """version_snapshot 만 단독 조회. REQ-ACOUSTIC-050 추적용."""
    return {"version_snapshot": version_snapshot()}


@app.post("/analyze")
async def analyze(
    audio: Optional[UploadFile] = File(None),
    file: Optional[UploadFile] = File(None),
) -> JSONResponse:
    """음향 분석 엔드포인트.

    multipart/form-data 로 'audio' (또는 'file') 키에 오디오 파일을 받는다.
    지원 컨테이너: webm / mp4 / wav / ogg / mp3 / m4a (ffmpeg 가 디코딩 가능한 모든 것).

    응답:
      - 200 + ok=true + result + version_snapshot   → 정상 측정 (또는 degraded)
      - 200 + fallback=true + reason="decode_error" → 디코딩 실패 (Next.js fallback 호환)
      - 200 + fallback=true + reason="parselmouth_error" → 분석 단계 예외
      - 400 + fallback=true + reason="missing_audio_file" → 파일 누락
    """

    upload = audio or file
    if upload is None:
        return JSONResponse(
            content=_fallback_payload("missing_audio_file"),
            status_code=400,
        )

    try:
        raw = await upload.read()
    except Exception as exc:
        # 업로드 자체 실패는 매우 드물지만 안전을 위해 처리.
        return JSONResponse(
            content={**_fallback_payload("upload_read_error"), "detail": str(exc)},
            status_code=400,
        )

    if not raw:
        return JSONResponse(
            content=_fallback_payload("empty_audio_file"),
            status_code=400,
        )

    filename = upload.filename or "recording.webm"

    try:
        result = analyze_audio(raw, filename)
    except AudioDecodeError as exc:
        # 컨테이너/코덱 디코딩 실패 — ffmpeg 미설치 또는 손상 파일.
        print(f"[voice-analysis] decode error: {exc}", file=sys.stderr)
        return JSONResponse(content=_fallback_payload("decode_error"))
    except AcousticAnalysisError as exc:
        print(f"[voice-analysis] parselmouth error: {exc}", file=sys.stderr)
        return JSONResponse(content=_fallback_payload("parselmouth_error"))
    except Exception as exc:  # noqa: BLE001 — 마지막 안전망
        print(f"[voice-analysis] unexpected error: {exc}", file=sys.stderr)
        return JSONResponse(content=_fallback_payload("internal_error"))

    return JSONResponse(
        content={
            "ok": True,
            "result": result,
            "version_snapshot": version_snapshot(),
        }
    )
