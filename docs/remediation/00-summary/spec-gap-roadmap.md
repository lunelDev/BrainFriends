# 제품제안서 vs 코드 갭 로드맵

## 목적

`브레인프렌즈 제품제안서.pdf` (2026-04-27 제출, 한국의료기기안전정보원 NIDS 트랙)의 클레임과 현재 레포 구현 사이의 갭을 정리하고, 그 갭을 어떤 순서로 메울지 우선순위와 작업 단위를 정의한다.

본 문서는 단일 진실원이 아니다. 인허가 신청서 본문·기획서가 갱신되면 이 문서도 함께 갱신해야 한다.

## 한 줄 진단

- **알고리즘 핵심 8 모듈 평균 일치율 약 58%**
- **5채널 멀티모달 컨셉 기준 60%** — 시선·AAC 채널이 비어있음
- **SaMD 인프라(V&V/보안/AI평가) 포함 가중 일치율 약 70~72%**

가장 큰 격차는 세 곳에 있다.

1. **시선 추적, AAC 통합** — 제안서 p.7 "5채널" 중 4·5번 보조 채널로 명시되어 있지만 코드에 흔적이 없다.
2. **Whisper-ko Fine-tuning / WASM 음성 온디바이스** — STT가 OpenAI 외부 호출이라 제안서 p.11 "WASM 온디바이스·원본 미전송" 클레임과 충돌한다. (안면은 정합)
3. **Bayesian Adaptive Testing / IRT** — 제안서가 "핵심 모듈"로 적었으나 현재 코드는 `articulationConfig.ts` 의 strict / balanced / lenient 휴리스틱 수준이다.

반대로 제안서보다 깊게 구현된 부분도 있다. K-WAB 채점은 제안서가 "4개 하위 항목"이라 적었지만 실제로는 6개 하위 + AQ/LQ/CQ 까지 들어가 있고, 처방·조직·치료사 메모 / follow-up / 시스템 모니터링 / V&V export 등 운영 인프라는 제안서에 한 줄도 적혀있지 않다.

## 모듈 매핑 표

| 제안서 모듈 (p.7) | 현재 코드 위치 | 일치도 | 메모 |
| --- | --- | --- | --- |
| 음성 분석 AI (Whisper-ko Fine-tuning, WER 15%↓) | `src/app/api/proxy/stt/route.ts`, `voice-analysis-service/` | ~75% | Whisper API + 음향 호출은 됨. 한국어 fine-tuning 모델은 미적용 (whisper-1 일반 모델) |
| 안면 AI (MediaPipe 478 랜드마크, 구강 운동) | `src/components/diagnosis/FaceTracker.tsx`, `src/lib/analysis/articulationAnalyzer.ts`, `src/utils/faceAnalysis.ts` | 100% | FaceLandmarker + lip metrics + 폐쇄/개방 분석 |
| 반응시간 측정 (100ms) | `src/lib/kwab/SessionManager.ts`, step-1~5 | 100% | reactionTime 필드가 모든 단계에 일관 |
| 시선 추적 (보조 채널) | — | **0%** | gaze / iris 추출 코드 없음 |
| AAC 통합 (심볼 기반 발화 의도 예측) | — | **0%** | AAC 모듈 부재 |
| K-WAB 자동화 (4개 하위 항목 채점) | `src/lib/kwab/KWABScoring.ts`, `src/app/api/kwab/final-result` | 120% | 6개 하위검사 + AQ/LQ/CQ |
| WASM 온디바이스 추론 (P95 41.5ms) | `FaceTracker.tsx` (MediaPipe wasm) | ~50% | 안면만 wasm. 음성 STT는 OpenAI 외부 호출 |
| Bayesian Adaptive / IRT 난이도 조절 | — | ~20% | 휴리스틱 적응형만 존재. IRT/Bayesian 명시 구현 없음 |

## 임상 워크플로우 / 사용자 구조

| 제안서 항목 | 현재 코드 | 일치도 |
| --- | --- | --- |
| Step1 초기설정 → Step2 일일세션 → Step3 주간 K-WAB | `src/app/(training)/programs/step-1~6` + `select-page/*` + `result-page/*` | ~90% |
| 1차 환자 / 2차 치료사·의사 / 3차 보호자 3-Tier | `src/app/therapist/*` + `link-care` + admin | ~65% (보호자 면이 가장 약함) |
| 치료사 대시보드 | `src/app/therapist/patients/[patientId]` + `src/app/api/therapist/reports/note(s)` | ~90% |
| 보호자 주간 리포트 자동 발송 | — | ~15% (스케줄 발송 로직 미발견) |
| 처방 기반 운영 | `prescriptions` 풀스택 | 90% |

## SaMD 인프라

| 제안서 항목 | 현재 코드 | 일치도 |
| --- | --- | --- |
| SW V&V | `src/lib/vnv/*` + `npm run test:vnv` | 85% |
| 사이버보안 | `src/lib/security/*`, `src/app/api/security-audit` | 80% |
| AI 성능평가 | `src/lib/ai/*` | 85% |
| 부작용 보고 | `src/components/adverse-events`, `src/app/api/adverse-events/me` | 90% |
| ISO 13485 / IEC 62304 / ISO 14971 / IEC 62366 | `docs/remediation`, `docs/submission`, `docs/security` | 60% (문서 수준) |

---

# 우선순위 작업 목록

## P0 — 인허가 신청서·시험기관 제출 전 반드시

### 1. 시선 추적(Gaze) 모듈 — 예상 2~3일, 난이도 낮음

**왜 P0인가**: 가장 빠른 win. 이미 `FaceTracker.tsx` 가 MediaPipe `FaceLandmarker` 로 478 랜드마크를 뽑고 있고, 이 안에 iris 랜드마크 468–477 이 포함된다. 새 의존성·새 모델 없이 보조 채널을 만들 수 있다.

작업 분해:

- `src/utils/faceAnalysis.ts` 에 `calculateGazeMetrics(landmarks)` 추가 — 좌/우 홍채 중심 vs 눈 윤곽으로 normalized gaze vector, 화면 중앙 응시 비율, 주의 분산 인덱스
- `src/components/diagnosis/FaceTracker.tsx` 의 `ExtendedMetrics` 타입과 `onMetricsUpdate` 호출에 `gaze` 필드 추가
- `src/lib/training/MetricManager.ts` / `src/lib/kwab/SessionManager.ts` 에 `attentionRatio`, `offTaskTimeMs` 누적
- `src/components/training/AnalysisSidebar.tsx` 및 치료사 결과 페이지에 시각화
- V&V: `src/lib/vnv/deterministicChecks.ts` 에 gaze 결정성 테스트 1건

### 2. AAC(보완대체 의사소통) 입력 모듈 — 예상 5~7일, 난이도 중

**왜 P0인가**: 제안서 차별성 표(p.11)의 "환자 의도 기반 콘텐츠 / 5채널" 두 항목에 직접 연결된다. 발화가 어려운 실어증 환자가 1차 대상자라 임상 정합성도 크다.

작업 분해:

- 데이터 시드: `data/aac/` 아래 카테고리별 심볼 200~300개 (인사·식사·통증·장소·감정). 한국어 라벨 + 픽토그램 + 카테고리 + 사용 빈도
- DB 스키마: `aac_symbols`, `aac_user_vocab`, `aac_utterance_intents` (`src/lib/server/postgres.ts` 패턴 재사용)
- 컴포넌트: `src/components/training/AACBoard.tsx` — 격자형 심볼 보드, 카테고리 탭, 최근 사용
- 통합: step-1·step-2·sentence-magic 에 "말 대신 심볼" 토글 → 선택 sequence 를 transcript 처럼 처리
- API: `src/app/api/aac/route.ts` (조회), `src/app/api/aac/intent/route.ts` (선택 sequence 저장 + 발화 의도 라벨)
- 발화 의도 예측은 Phase 1 에서는 규칙 기반 (심볼 시퀀스 → 템플릿 문장). ML 모델은 P2 로 미룬다

### 3. "WASM 온디바이스 / 원본 미전송" 클레임 정합성 — 결정 즉시

**리스크**: 현재 STT 는 `src/app/api/proxy/stt/route.ts` 가 OpenAI 로 원본 오디오를 전송한다. 제안서 p.7 "WASM 온디바이스 · 서버리스 · 원본 미전송" 과 충돌한다. 인허가 심사·사이버보안 평가에서 가장 위험한 부분.

세 갈래 중 택 1:

- **A. 즉시 모델 교체 (권장)**: `transformers.js` 또는 `whisper.cpp` WASM 빌드를 클라이언트에 적재 → 안면처럼 STT 도 온디바이스. 모델 ~70MB · RTF 0.4~1.0 수준이라 첫 로딩·저사양 환경 검증 필요. 2~3주.
- **B. 분리형 (권장 차선)**: 일상 훈련은 WASM Whisper-base, 주간 K-WAB 평가만 서버 Whisper. 제안서 표현을 "훈련 세션은 온디바이스, 평가는 서버 처리" 로 분리 기재. 1~1.5주.
- **C. 기획서 수정**: WASM 클레임 자체를 "MediaPipe 안면 분석은 온디바이스 / STT 는 보안 프록시" 로 정정. 코드 변경 0 이지만 차별성 표가 약해진다.

→ **결정: B. 분리형으로 진행.** 일상/게임 훈련 STT 는 WASM 온디바이스를 원칙으로 하고, 주간 K-WAB/임상 평가는 `sttUseCase` 로 명시된 서버 Whisper 경로를 별도 추적한다. WASM 엔진 도입 전 임시 서버 fallback 은 `NEXT_PUBLIC_STT_TRAINING_SERVER_FALLBACK` / `STT_TRAINING_SERVER_FALLBACK` 플래그가 켜진 경우에만 허용한다.

## P1 — RCT/실증 진입 전 (`26.07~`)

### 4. IRT / Bayesian Adaptive Testing — 예상 7~10일, 난이도 중상

**왜 P1인가**: 제안서가 "핵심 모듈"에 IRT 를 넣었지만 코드는 `src/lib/analysis/articulationConfig.ts` 의 strict / balanced / lenient 휴리스틱이 전부. 인허가 단계는 "적응형 난이도" 개념으로도 통과 가능하지만 RCT 가기 전엔 실제 모델이 필요.

작업 분해:

- `src/lib/adaptive/irt.ts` — 2PL IRT 모델 (item parameter `a`, `b` + ability `θ`). EAP 또는 MAP 추정
- 단어/문항 풀에 difficulty 메타데이터 시딩: 처음엔 임상가가 1~5 등급 매기고, 누적 정답률로 calibration
- `pickNextItem(theta, pool, infoCriterion="MFI")` — Maximum Fisher Information 으로 다음 문항 선택
- step-1~5 `page.tsx` 진입점에서 random / 순차 → `pickNextItem` 호출로 전환 (한 step 씩 점진 적용)
- 치료사 대시보드: 환자 ability θ 추이 그래프
- V&V: 모의 응답 시퀀스 (고정 시드) 로 θ 수렴 결정성 테스트

### 5. Whisper-ko 도메인 적응 — 예상 5~10일, 난이도 중

**왜 P1인가**: 제안서 "WER 15% 이하 / 한국어 코퍼스 특화" 의 정량 목표 근거. 인허가 AI 성능평가 단계에서 정확도 표가 필요하다.

작업 분해:

- 단기 (즉시): 현재 `outgoing.append("prompt", targetText)` 패턴이 이미 있다. 여기에 task 별 도메인 어휘 vocab biasing prompt 를 시스템적으로 추가 (조음 단어, K-WAB 자극어, 한국어 음운 변이형). `src/lib/speech/SpeechAnalyzer.ts` 에 prompt 빌더
- 중기: `voice-analysis-service` 에 자체 검증셋 평가 엔드포인트 추가 — `data/eval/ko_aphasia_set.csv` (임상 녹음 50~100건) 대상 WER/CER 계산. `src/lib/ai/evaluationDataset.ts` 패턴과 연결
- 장기 (P2): faster-whisper-large-v3-ko 또는 KoWhisper 자가호스팅 — 별도 GPU 서버 필요

### 6. 보호자 주간 리포트 자동 발송 — 예상 4~5일, 난이도 중

**왜 P1인가**: 제안서 p.8 "보호자 주간 리포트 자동 발송 설정" + 3차 사용자 (보호자) 흐름 정합성. 현재 `link-care` 까지만 있고 자동 발송 로직이 없다.

작업 분해:

- DB: `guardian_links` 테이블 (환자 ↔ 보호자, 동의 상태, 알림 채널)
- `src/lib/server/weeklyReport.ts` — 주간 K-WAB AQ 변화 + step 별 완료율 + 부작용 보고 0 건 명시
- 발송 채널: Phase 1 이메일 (SES 또는 SMTP) → Phase 2 카카오 알림톡
- 스케줄러: Vercel cron 또는 별도 Node worker. `src/app/api/cron/weekly-report/route.ts` + `vercel.json` 또는 systemd timer
- 보호자가 별도 로그인 없이 볼 수 있는 read-only 페이지 `src/app/guardian/[token]/page.tsx`

## P2 — 시판 준비기 / Nice-to-have

7. **시선 추적 calibration UI** (9-point grid) — gaze 정확도 정량화에 필요. 1주
8. **AAC 발화 의도 예측 ML** — 규칙 기반에서 sequence → intent 분류기로 업그레이드. 데이터 누적 후
9. **K-WAB 음향 자동 채점 강화** — 코드는 이미 6 개 하위검사 다룸. 임상 자료로 가중치 calibration 만 남음

## 권장 진행 순서

시선 (2~3 일) → AAC (1 주) → WASM-STT 결정 (즉시) → IRT (2 주) → Whisper-ko 평가셋·prompt biasing (1 주) → 보호자 주간 리포트 (1 주)

P0 1·2·6 은 제안서가 약속한 "5채널 멀티모달 + 3-tier 사용자" 모양을 그대로 살리는 항목이고, P1 3·4·5 는 정량 KPI (WER 15%, P95 41.5ms, 적응형 난이도) 클레임을 인허가 심사 때 방어할 수 있게 만드는 항목이다.

## 갱신 이력

- 2026-04-29: 초안. 제품제안서 v1 (2026-04-27 제출본) 기준 갭 분석 및 P0/P1/P2 구분
- 2026-04-29: **P0-2 AAC Phase 1 완료**
  - `src/constants/aacData.ts` 신규 — Universal subjects 5 + Universal intents 10 + place 별 (nouns 9 + intents 8) × 6 places. visualTrainingData emoji 재사용 (라이선스 부담 0). Stable id 체계 (`subj/me`, `intent/cafe/0`, `noun/home/3` 등)
  - `src/lib/aac/intentTemplate.ts` 신규 — 규칙 기반 결정성 sequence→sentence 빌더. subject fallback "저", 특수 intent (도와주세요/물/화장실 등), noun-only 폴백, multi-intent 그리고-연결, unknownIds 누적
  - `src/components/aac/AACBoard.tsx` 신규 — place 탭 + kind 별 그리드 (subject/intent/noun) + 시퀀스 preview + ⌫/clear/commit 버튼
  - `src/app/(training)/programs/aac/page.tsx` 신규 — standalone 라우트, /api/aac/intent 로 commit
  - `src/app/api/aac/intent/route.ts` 신규 — POST 환자 세션 필수 + body validate + 서버측 sentence 재생성 + audit log + IF NOT EXISTS 로 `aac_intent_logs` 테이블 자동 생성
  - `src/lib/vnv/requirements.ts` `SR-AAC-008` 추가
  - `src/lib/vnv/runDeterministicChecks.ts` `runAacIntentTemplateCheck` (TC-AAC-001) 추가 — 6 케이스 (subject+noun+intent / 단독 도와주세요 / 빈 시퀀스 / noun-only 폴백 / unknown-only / fallback subject)
  - **검증**: `npm run test:vnv` → **15/15 PASS** (TC-AAC-001 포함). tsc 새 파일 클린 (타입 에러 0)
  - 후속: step-2/step-4 의 "말 대신 심볼" 토글 통합, AACBoard 의 사용 빈도 sort, 발화 의도 ML 분류기 (Phase 2)
- 2026-04-29: **P0-1 시선 추적 데이터 레이어 + 누적기 + dev 시각화 완료**
  - `src/utils/faceAnalysis.ts` 에 `GazeMetrics` 타입 + `calculateGazeMetrics(landmarks)` 추가 (MediaPipe iris 랜드마크 468/473 + 눈 윤곽 4점 사용, dead-zone 0.3 / 감점 구간 0.7 기준)
  - `src/components/diagnosis/FaceTracker.tsx` 의 `ExtendedMetrics` 에 `gaze` 필드 + smoothing + no-face / init-error 폴백 처리
  - `src/app/(training)/TrainingContext.tsx` 의 `SidebarMetrics` 에 `gazeXNorm / gazeYNorm / gazeCentered / gazeAttention / irisDetected` 추가
  - `src/app/(training)/layout.tsx` 의 `updateSidebar` 호출에 gaze 5 필드 매핑 + `gazeAccumulator.record()` 결합
  - `src/lib/training/gazeAccumulator.ts` 신규 — 세션 단위 attentionRatio / offTaskRatio / irisDetectionRatio / measurementQuality 산출
  - `src/components/training/DeveloperKpiPanel.tsx` 에 시선 응시 인디케이터 추가 (dev 빌드 한정)
  - `src/lib/vnv/requirements.ts` 에 `SR-GAZE-007` 요건 정의
  - `src/lib/vnv/runDeterministicChecks.ts` 에 `runGazeMetricsCheck` (TC-GAZE-001) + `runGazeAccumulatorCheck` (TC-GAZE-002) 추가
  - **검증**: `npm run test:vnv` → 14/14 PASS (TC-GAZE-001, TC-GAZE-002 포함). `npx tsc --noEmit` → exit 0 (타입 클린)
  - 후속: 치료사 화면용 시선 시각화, calibration UI(9-point grid), 결과 리포트에 gazeAccumulator.report() 임베딩
- 2026-04-29: **P0-3 WASM-STT 갈래 결정 + 정책 레이어 1차 완료**
  - 결정: B. 분리형. 일상/게임 훈련은 WASM 온디바이스 우선, 주간 K-WAB/임상 평가는 서버 Whisper 허용 경로로 분리
  - `src/lib/speech/sttPolicy.ts` 신규 — `daily_training / game_training / weekly_kwab / clinical_evaluation` useCase 와 `wasm_whisper / server_whisper / disabled` 정책 결정
  - `src/app/api/proxy/stt/route.ts` 에 서버 송신 가드 추가 — 훈련 useCase 는 `STT_TRAINING_SERVER_FALLBACK=false` 일 때 403 fallback
  - `src/lib/speech/SpeechAnalyzer.ts` 에 `sttUseCase`, 도메인 prompt builder 연동. `src/components/lingo/SentenceMagicGame.tsx`, `sing-training/page.tsx` 의 훈련 STT 호출도 명시 태깅
  - `src/lib/vnv/requirements.ts` `SR-STT-009` 추가, `src/lib/vnv/runDeterministicChecks.ts` `TC-STT-001` 추가
  - 후속: 실제 WASM Whisper 엔진(`transformers.js` 또는 `whisper.cpp`) 연결, 주간 K-WAB 서버 STT 호출부에는 `weekly_kwab` useCase 명시, 저사양 기기 RTF/P95 측정
- 2026-04-29: **P1-6 보호자 주간 리포트 Phase 1 완료**
  - `src/lib/guardian/weeklyReportSummary.ts` 신규 — 최근 7일 훈련 수, 언어/노래 세션 수, 최신 AQ, AQ 변화, 평균 점수, step별 완료율, 이상반응 상태 결정성 요약
  - `src/lib/server/guardianReportsDb.ts` 신규 — `guardian_report_links` 테이블 자동 생성, 토큰 hash 저장, 보호자 read-only 리포트 조회
  - `src/app/api/guardian/report-link/route.ts` 신규 — 환자 본인/admin/담당 치료사가 보호자용 링크 생성
  - `src/app/guardian/[token]/page.tsx` 신규 — 로그인 없는 토큰 기반 read-only 보호자 주간 리포트 화면
  - `src/app/api/cron/weekly-report/route.ts` 신규 — 발송 전 단계 cron preview/link generation API. 실제 이메일/SMS 발송은 아직 제외
  - `src/lib/vnv/requirements.ts` `SR-GUARDIAN-010` 추가, `src/lib/vnv/runDeterministicChecks.ts` `TC-GUARDIAN-001` 추가
  - **검증**: `npm run test:vnv` → 17/17 PASS. `npx tsc --noEmit` → exit 0
  - 후속: guardian 동의 상태/수신 채널 테이블, SMTP/SES 발송, 실패 재시도 큐, 보호자 링크 생성 버튼을 치료사 UI에 노출
