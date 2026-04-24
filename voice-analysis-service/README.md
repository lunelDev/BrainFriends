# BrainFriends voice-analysis-service

Parselmouth(Praat의 Python 바인딩) 기반 음향 분석 마이크로서비스입니다. BrainFriends Next.js 앱의
`src/app/api/proxy/voice-analysis/route.ts` 가 multipart 오디오를 보내면 F0 / Intensity /
Voicing Ratio / Duration 등의 음향 지표를 결정론적으로 계산해서 돌려줍니다.

자세한 산출 지표 정의는 `docs/remediation/01-sw-vnv/parselmouth-requirements.md`
(REQ-ACOUSTIC-001~031, 050) 를 따릅니다.

---

## 1. 3가지 모드 개요

음향 분석을 띄우는 방법은 3가지입니다. 상황에 맞게 골라서 쓰세요.

| 모드 | 환경변수 조합 | 외부 의존 | 언제 쓰나 |
| --- | --- | --- | --- |
| **A. 더미** | `NEXT_PUBLIC_DEV_MODE=true` | 없음 | UI/플로우 작업 중. 음향 수치는 보지 않을 때. 비용 0, 네트워크 0. |
| **B. 로컬 FastAPI** | `NEXT_PUBLIC_DEV_MODE=false` + (선택) `VOICE_ANALYSIS_URL=http://127.0.0.1:8001` | ffmpeg + Python | 실제 측정값을 검증해야 할 때. 로컬에서 같은 머신으로 같이 띄움. |
| **C. 운영 배포** | `NEXT_PUBLIC_DEV_MODE=false` + `VOICE_ANALYSIS_URL=https://your-host` | Docker 또는 systemd | NCP/AWS VM 에 별도 띄우고 Next.js 앱이 원격 호출. |

`VOICE_ANALYSIS_URL` 을 비워두면 프록시는 자동으로 `http://127.0.0.1:8001` 을 시도합니다 (모드 B 전제).

---

## 2. 모드 A — 더미 (가장 빠름, 비용 0)

`.env.local` 에 다음 한 줄만 두면 됩니다.

```env
NEXT_PUBLIC_DEV_MODE=true
```

`/api/proxy/voice-analysis` 가 결정론적 더미 응답(F0=220Hz 등)을 즉시 반환합니다. parselmouth 는 호출되지 않습니다.

이 서비스를 띄울 필요도 없습니다.

---

## 3. 모드 B — 로컬 FastAPI

### 사전 준비: ffmpeg 설치

WebM / MP4 / M4A 컨테이너 디코딩에 ffmpeg 가 필수입니다.

| OS | 설치 명령 |
| --- | --- |
| macOS | `brew install ffmpeg` |
| Ubuntu / WSL | `sudo apt-get update && sudo apt-get install -y ffmpeg` |
| Windows | `choco install ffmpeg` 또는 `scoop install ffmpeg` |

확인: `ffmpeg -version` 이 출력되면 OK.

### 실행

macOS / Linux / WSL:

```sh
cd voice-analysis-service
./run.sh
```

Windows PowerShell:

```powershell
cd voice-analysis-service
.\run.ps1
```

스크립트가 자동으로 `.venv` 를 만들고 `requirements.txt` 를 설치한 뒤 uvicorn 을 8001 포트에 띄웁니다.

### Next.js 앱 연결

`.env.local` 에 다음을 두세요. (기본 URL 을 쓰는 경우 `VOICE_ANALYSIS_URL` 은 생략 가능합니다.)

```env
NEXT_PUBLIC_DEV_MODE=false
# VOICE_ANALYSIS_URL=http://127.0.0.1:8001   # 비워두면 이 값이 기본값
```

### 헬스체크

```sh
curl http://127.0.0.1:8001/healthz
# {"ok":true,"service":"voice-analysis"}

curl http://127.0.0.1:8001/version
# {"version_snapshot":{"parselmouth":"...","praat_version_date":"...","python":"...","numpy":"..."}}
```

---

## 4. 모드 C — 운영 배포

### 옵션 C-1. Docker (권장)

```sh
cd voice-analysis-service
docker compose up -d --build
```

### 옵션 C-2. NCP / AWS VM 직접 배포

```sh
# Ubuntu 기준
sudo apt-get update && sudo apt-get install -y ffmpeg python3-venv python3-pip
cd /opt/voice-analysis-service   # 본 디렉토리를 옮긴 곳
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
nohup uvicorn main:app --host 0.0.0.0 --port 8001 > /var/log/voice-analysis.log 2>&1 &
```

운영 환경에서는 systemd 유닛으로 감싸는 걸 권장합니다.

### Next.js 앱 환경변수

운영 환경 (`.env.production` 또는 배포 플랫폼 secret):

```env
VOICE_ANALYSIS_URL=https://voice-analysis.your-domain.example
```

같은 VM 에 함께 띄우는 경우엔 `http://127.0.0.1:8001` 을 그대로 써도 됩니다 (외부 노출 X).

---

## 5. 응답 계약

`POST /analyze` (multipart/form-data, key=`audio` 또는 `file`) 의 응답:

```json
{
  "ok": true,
  "result": {
    "duration_sec": 1.42,
    "f0": {
      "mean_hz": 218.4,
      "std_hz": 12.1,
      "min_hz": 180.2,
      "max_hz": 260.1
    },
    "intensity": {
      "mean_db": 66.2,
      "max_db": 74.8
    },
    "voicing_ratio": 0.74,
    "measurement_quality": "measured"
  },
  "version_snapshot": {
    "parselmouth": "0.4.5",
    "praat_version_date": "...",
    "python": "3.11.x ...",
    "numpy": "1.26.x"
  }
}
```

| 필드 | 의미 | null 가능성 |
| --- | --- | --- |
| `result.duration_sec` | 전체 발화 길이 (초) — REQ-ACOUSTIC-004 | 디코딩은 됐으나 길이 산출 실패 시 null |
| `result.f0.mean_hz` | 유성음 프레임 F0 평균 — REQ-001 | 유성음 0개일 때 null |
| `result.f0.std_hz` | F0 표준편차 | 유성음 1개 이하일 때 null |
| `result.f0.min_hz` / `max_hz` | F0 최소/최대 | 유성음 없을 때 null |
| `result.intensity.mean_db` / `max_db` | dB 단위 강도 — REQ-002 | 무음/과소 신호 시 null |
| `result.voicing_ratio` | 0~1, 유성음 프레임 비율 — REQ-003 | 프레임 자체가 0개일 때 null |
| `result.jitter_local_pct` | Jitter (local), % — REQ-010 | 유성음 부족·PointProcess 실패 시 null |
| `result.shimmer_local_pct` | Shimmer (local), % — REQ-011 | 유성음 부족·PointProcess 실패 시 null |
| `result.hnr_mean_db` | HNR (Harmonics-to-Noise Ratio), dB — REQ-012 | Harmonicity 계산 실패 시 null |
| `result.formants.f1_hz` | 모음 mid-frame 에서 샘플링한 F1, Hz — REQ-020 | formant/voicing 추출 실패 시 null |
| `result.formants.f2_hz` | 모음 mid-frame 에서 샘플링한 F2, Hz — REQ-020 | formant/voicing 추출 실패 시 null |
| `result.formants.mid_frame_time` | 선택된 모음 mid-frame 의 시각(초) — REQ-021 | voiced run 이 비어있을 때 null |
| `result.measurement_quality` | `measured` / `degraded` / `failed` — REQ-030 | 항상 채워짐 |
| `version_snapshot` | parselmouth/Praat/Python/numpy 버전 — REQ-050 | fallback 응답일 때만 null |

### Fallback 응답

디코딩 또는 parselmouth 단계에서 실패하면 200 OK 로 다음과 같이 반환합니다 (Next.js 프록시의 fallback 패턴과 일치).

```json
{
  "ok": true,
  "result": { /* 모두 null, measurement_quality: "failed" */ },
  "version_snapshot": null,
  "fallback": true,
  "reason": "decode_error" // 또는 "parselmouth_error", "missing_audio_file" 등
}
```

`reason` 가 가질 수 있는 값:

- `missing_audio_file` — multipart 에 audio/file 키가 없음 (HTTP 400)
- `empty_audio_file` — 파일은 있으나 0바이트 (HTTP 400)
- `decode_error` — ffmpeg/soundfile 디코딩 실패
- `parselmouth_error` — parselmouth 호출 단계 예외
- `internal_error` — 그 외 예측 못 한 예외

### 측정 품질 게이트 (REQ-ACOUSTIC-030)

| 조건 | 결과 |
| --- | --- |
| `duration_sec < 0.3` | `degraded` (너무 짧음) |
| `voicing_ratio < 0.1` | `degraded` (유성음 거의 없음 → 잡음/무음 의심) |
| `max_intensity_db < 30` | `degraded` (마이크 미입력 의심) |
| 모든 핵심 지표 None | `failed` |
| 그 외 | `measured` |

`measurement_quality !== "measured"` 인 결과는 AI 평가셋에서 자동 제외됩니다 (REQ-ACOUSTIC-031).

---

## 6. 트러블슈팅

### `decode_error` 만 계속 나옴

가장 흔한 원인은 ffmpeg 미설치입니다. WebM/MP4/M4A 는 soundfile 이 못 읽기 때문에 pydub 가 ffmpeg 를 호출해야 합니다.

```sh
ffmpeg -version
# command not found 면 위 "사전 준비" 섹션 참고
```

Docker 로 띄운 경우엔 Dockerfile 이 ffmpeg 를 자동 설치하므로 컨테이너를 다시 빌드하세요.

```sh
docker compose build --no-cache
docker compose up -d
```

### `pip install praat-parselmouth` 가 빌드 실패

미리 빌드된 wheel 이 없는 OS/Python 조합 (예: musl 기반 Alpine, 일부 ARM 환경) 에서 발생합니다. 해결 방법:

- Python 3.11 이상 + glibc 기반 (Debian/Ubuntu/macOS) 환경을 쓰세요.
- ARM Mac (Apple Silicon) 에서는 일반적으로 wheel 이 제공됩니다. 안 되면 `pip install --upgrade pip` 후 재시도.
- 제공된 `Dockerfile` 은 `python:3.11-slim` 기반이므로 가장 안전합니다.

### CORS 에러

기본 설정은 `allow_origins=["*"]` 입니다. 운영에서는 `main.py` 의 `CORSMiddleware` 에 실제 도메인을 명시해 좁히세요.

```python
allow_origins=["https://app.brainfriends.example"],
```

또한 정상 경로는 Next.js 의 `/api/proxy/voice-analysis` 를 통한 server-to-server 호출이라 브라우저에서 직접 부르지 않으면 CORS 가 문제되지 않습니다.

### 프록시가 502 / `upstream_502` 반환

본 서비스가 안 떠 있거나 다른 포트에 떠 있습니다.

```sh
curl http://127.0.0.1:8001/healthz
```

응답이 없으면 `./run.sh` 가 살아 있는지, 또는 `docker compose ps` 로 컨테이너 상태를 확인하세요.

### Windows 에서 `Activate.ps1` 실행 정책 오류

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
.\run.ps1
```

---

## 7. 디렉토리 구조

```
voice-analysis-service/
├── main.py             # FastAPI 앱 + /analyze, /healthz, /version
├── analyzer.py         # parselmouth 음향 분석 로직
├── requirements.txt
├── Dockerfile          # python:3.11-slim + ffmpeg
├── docker-compose.yml  # 단일 서비스, 포트 8001
├── README.md           # 본 문서
├── run.sh              # macOS/Linux/WSL 로컬 실행
├── run.ps1             # Windows PowerShell 로컬 실행
└── .gitignore
```

본 서비스는 결정론적입니다 — 같은 입력은 항상 같은 출력을 냅니다. (REQ-ACOUSTIC 전제)
