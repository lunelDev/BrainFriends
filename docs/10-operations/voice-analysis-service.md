# 음향 분석 서비스 (voice-analysis-service) 운영 가이드

BrainFriends 의 Parselmouth 기반 음향 분석 마이크로서비스를 어떻게 띄우는가에 대한 1페이지 가이드입니다.
자세한 내용/트러블슈팅은 `voice-analysis-service/README.md` 를 보세요.

## 무엇인가

- 위치: `voice-analysis-service/` (프로젝트 루트 바로 아래)
- 스택: Python 3.11 + FastAPI + Parselmouth(Praat) + ffmpeg
- 호출 경로: 브라우저 → Next.js `/api/proxy/voice-analysis` → 본 서비스 `/analyze`
- 응답 계약: `src/app/api/proxy/voice-analysis/route.ts` 의 `AcousticResponse`
- 산출 지표 정의: `docs/remediation/01-sw-vnv/parselmouth-requirements.md` (REQ-ACOUSTIC-001~031, 050)

## 3가지 모드

| 모드 | 환경변수 | 외부 의존 | 용도 |
| --- | --- | --- | --- |
| A. 더미 | `NEXT_PUBLIC_DEV_MODE=true` | 없음 | UI 작업 중. 음향 수치 안 봄. |
| B. 로컬 FastAPI | `NEXT_PUBLIC_DEV_MODE=false` | ffmpeg + Python | 실측값 검증 필요할 때. |
| C. 운영 배포 | `VOICE_ANALYSIS_URL=https://...` | Docker 또는 systemd | NCP/AWS VM 배포. |

`VOICE_ANALYSIS_URL` 미설정 시 프록시는 `http://127.0.0.1:8001` 을 시도합니다.

## 모드 B 빠른 시작

```sh
# 1. ffmpeg 설치 (한 번만)
brew install ffmpeg            # macOS
# sudo apt-get install -y ffmpeg   # Ubuntu/WSL
# choco install ffmpeg              # Windows

# 2. 서비스 띄우기
cd voice-analysis-service
./run.sh                       # Windows: .\run.ps1

# 3. 헬스체크
curl http://127.0.0.1:8001/healthz

# 4. .env.local 에서 NEXT_PUBLIC_DEV_MODE=false 로 두면
#    Next.js 가 자동으로 본 서비스를 호출
```

## 모드 C 빠른 시작 (Docker)

```sh
cd voice-analysis-service
docker compose up -d --build
```

운영 환경의 `.env` 또는 배포 secret 에 다음 추가:

```env
VOICE_ANALYSIS_URL=https://voice-analysis.your-domain.example
```

같은 VM 에 함께 띄우는 경우엔 `http://127.0.0.1:8001` 그대로 쓰면 됩니다 (외부 노출 X).

## 엔드포인트

- `POST /analyze` — multipart, key=`audio` 또는 `file`. AcousticResponse 반환.
- `GET  /healthz` — `{"ok":true,"service":"voice-analysis"}`.
- `GET  /version` — version_snapshot 4종 (parselmouth/Praat/Python/numpy).

## Fallback 동작

본 서비스는 디코딩 또는 parselmouth 단계에서 예외가 나도 200 OK 로
`{ ok:true, fallback:true, reason:"...", result:{...all null, measurement_quality:"failed"} }`
를 반환합니다 (Next.js 프록시의 fallback 패턴과 일치). reason 종류:

- `missing_audio_file` (HTTP 400)
- `empty_audio_file` (HTTP 400)
- `decode_error` — 보통 ffmpeg 미설치
- `parselmouth_error`
- `internal_error`

## 자주 막히는 곳

- **`decode_error` 만 나옴** → ffmpeg 미설치. `ffmpeg -version` 으로 확인.
- **`pip install praat-parselmouth` 실패** → glibc 기반 OS + Python 3.11 권장. Docker 가 가장 안전.
- **CORS 운영 노출** → `main.py` 의 `allow_origins=["*"]` 를 운영 도메인으로 좁힐 것.

## 보안

- 본 서비스는 인증이 없습니다. 운영에서는 같은 VM 의 Next.js 프록시를 통해서만 접근하도록 `127.0.0.1` 바인딩 또는 보안 그룹/iptables 로 제한하세요.
- 임시 wav 파일은 분석 직후 OS 임시 디렉토리에서 삭제됩니다 (`analyzer.py::_silently_unlink`).
