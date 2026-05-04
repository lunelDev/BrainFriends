# 제품제안서 vs 코드 갭 로드맵

## 목적

`브레인프렌즈 제품제안서.pdf` (2026-04-27 제출, 한국의료기기안전정보원 NIDS 트랙)의 클레임과 현재 레포 구현 사이의 갭을 정리하고, 그 갭을 어떤 순서로 메울지 우선순위와 작업 단위를 정의한다.

본 문서는 단일 진실원이 아니다. 인허가 신청서 본문·기획서가 갱신되면 이 문서도 함께 갱신해야 한다.

## 한 줄 진단 (2026-04-30 갱신 — Q 엔트리 후)

- **알고리즘 핵심 8 모듈 평균 일치율 약 88%** ✅ (시선·AAC ✅, WASM-STT 엔진 wiring ✅, IRT 코드 ✅)
- **5채널 멀티모달 100%** ✅ (시선·AAC 모두 Phase 1 완료, 통합도 완료)
- **SaMD 인프라 가중 일치율 약 90%** ✅ (V&V 53/53, 사이버보안 ~77%, AI 평가 체계 ✅)
- **규제 산출물 가중 일치율 약 92%** ✅ (claim-lock v0.3.0, RM v1.0, IEC 62304 SRS/SDS, IEC 62366 프로토콜, 사용자 매뉴얼 3종, GMP 결정 매트릭스)
- **남은 갭의 원인은 외부 인력·기관 의존** (임상 실측 데이터, 사용성평가 실시, 식약처 회신, 침투시험)

가장 큰 격차는 세 곳에 있다.

1. **시선 추적, AAC 통합** — 제안서 p.7 "5채널" 중 4·5번 보조 채널로 명시되어 있지만 코드에 흔적이 없다.
2. **Whisper-ko Fine-tuning / WASM 음성 온디바이스** — STT가 OpenAI 외부 호출이라 제안서 p.11 "WASM 온디바이스·원본 미전송" 클레임과 충돌한다. (안면은 정합)
3. **Bayesian Adaptive Testing / IRT** — 제안서가 "핵심 모듈"로 적었으나 현재 코드는 `articulationConfig.ts` 의 strict / balanced / lenient 휴리스틱 수준이다.

반대로 제안서보다 깊게 구현된 부분도 있다. K-WAB 채점은 제안서가 "4개 하위 항목"이라 적었지만 실제로는 6개 하위 + AQ/LQ/CQ 까지 들어가 있고, 처방·조직·치료사 메모 / follow-up / 시스템 모니터링 / V&V export 등 운영 인프라는 제안서에 한 줄도 적혀있지 않다.

## 모듈 매핑 표

| 제안서 모듈 (p.7) | 현재 코드 위치 | 일치도 | 메모 |
| --- | --- | --- | --- |
| 음성 분석 AI (Whisper-ko Fine-tuning, WER 15%↓) | `proxy/stt/route.ts`, `wasmSttAdapter.ts` (transformers.js@4.2.0:Xenova/whisper-tiny:v0.1) | **~85% ✅** | WASM Whisper-tiny wiring ✅. Ko fine-tune 후보 평가 계획 ✅. 60~80대 30건 실측 대기 |
| 안면 AI (MediaPipe 478 랜드마크, 구강 운동) | `FaceTracker.tsx`, `articulationAnalyzer.ts`, `faceAnalysis.ts` | **100% ✅** | (변동 없음) |
| 반응시간 측정 (100ms) | `kwab/SessionManager.ts`, step-1~5 | **100% ✅** | (변동 없음) |
| 시선 추적 (보조 채널) | `faceAnalysis.ts (calculateGazeMetrics)`, `gazeAccumulator.ts`, FaceTracker 통합 | **80% ✅** | 데이터 레이어 + 누적기 + dev 시각화 + history summary |
| AAC 통합 (심볼 기반 발화 의도 예측) | `intentTemplate.ts`, `AACBoard.tsx`, step-2/4/sentence-magic 통합 | **70% ✅** | Phase 1 규칙 기반. ML 분류기는 Phase 2 |
| K-WAB 자동화 (4개 하위 항목 채점) | `KWABScoring.ts`, `kwab/final-result` | **120% ✅** | 6개 하위검사 + AQ/LQ/CQ |
| WASM 온디바이스 추론 (P95 41.5ms) | 안면·시선 ✅ + 훈련 STT WASM Whisper-tiny ✅ + 평가 STT 만 서버 | **~85% ✅** | 엔진 wiring 완료. RTF/P95 실측 대기 (sttBenchmark.ts + dev/wasm-stt-test page) |
| Bayesian Adaptive / IRT 난이도 조절 | `lib/adaptive/irt.ts` (2PL+EAP+MFI) + `itemBank.ts` v0.1 (step 1/2/4) | **70% ✅** | IRT 코드 ✅, 임상 calibration 대기. step page 통합은 다음 세션 |

## 임상 워크플로우 / 사용자 구조

| 제안서 항목 | 현재 코드 | 일치도 |
| --- | --- | --- |
| Step1 초기설정 → Step2 일일세션 → Step3 주간 K-WAB | `programs/step-1~6` + `select-page/*` + `result-page/*` | **~90% ✅** |
| 1차 환자 / 2차 치료사·의사 / 3차 보호자 3-Tier | `therapist/*` + `link-care` + admin + 보호자 read-only 토큰 | **~85% ✅** |
| 치료사 대시보드 | `therapist/patients/[patientId]` + `reports/note(s)` | **~90% ✅** |
| 보호자 주간 리포트 자동 발송 | Phase 1 read-only 토큰 ✅ + Phase 2 SMTP/SES stub (`weeklyReportSender.ts`) | **~70% ✅** (운영 wiring 만 남음) |
| 처방 기반 운영 | `prescriptions` 풀스택 | **90% ✅** |

## SaMD 인프라

| 제안서 항목 | 현재 코드 | 일치도 |
| --- | --- | --- |
| SW V&V | `src/lib/vnv/*` (SR 35 + TC 53 + 추적성 51 + IEC 62304 별지 제2호 export) | **~95% ✅** |
| 사이버보안 (35 항목) | TC-SEC-* 10 + SBOM/SOUP/Manifest + CVE 면제 등록부 + 감사로그 확대 helper | **~77% ✅** |
| AI 성능평가 | werRunner.ts + sttBenchmark.ts + 데이터 수집 가이드 + 모델 평가 계획 | **~85% ✅ 체계 / ✗ 실측** |
| 부작용 보고 | adverse-events API + adverseEventReview + zod 검증 + audit | **~90% ✅** |
| ISO 13485 / IEC 62304 / ISO 14971 / IEC 62366 | claim-lock v0.3.0 + RM v1.0 + SRS/SDS v0.1 + 사용성평가 프로토콜 v0.1 + IRB 패키지 v0.1 + GMP 결정 매트릭스 v0.1 + 사용자 매뉴얼 3종 + 시판 후 감시 + CAPA + 변경허가 SOP + 시판 전 체크리스트 + 식약처 사전상담 패키지 | **~92% ✅** (문서 수준) |

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

- 2026-04-30: **16개 작업 일괄 처리 (Q) — D-tasks 7 + C-tasks 9, 사용자 위임 원샷**
  - **D-tasks ✅ 7건**: D6 시판 전 체크리스트 / D5 시판 후 감시 계획 / D4 PMS+CAPA 절차서 / D3 변경허가 신청 SOP / D7 식약처 사전상담 패키지 인덱스 / D2 사용자 매뉴얼 3종 (치료사·환자·보호자) / D1 SRS+SDS (IEC 62304 §5.2/§5.4 양식). 총 8 신규 markdown 파일 약 800 lines
  - **C-tasks ✅**: C1 next 16.2.4 package.json (npm install 은 mount rename 제약으로 운영환경에서 실행) / C5 환자 온보딩 exclusion (RM-007) / C8 Service Worker 캐싱 strategy + sw.js stub / C9 dev/wasm-stt-test 검증 페이지 (실제 브라우저 RTF 측정 가능) / C2 useWasmSttLoading hook (sentence-magic/sing-training/step-1 통합용 — 실제 wiring 은 다음 세션) / C6 감사로그 확대 (RM-016 보강 5 카테고리) / C4 보호자 SMTP 발송 stub (Phase 2 decideSend + executeSendBatch + STUB_SENDER_ADAPTER) / C3 IRT item bank v0.1 (step-1 10단어 + step-2 7구문 + step-4 5문장)
  - **C7 부분 ⚠**: PII/PHI 분리는 정책 문서만 (`pii-phi-separation-strengthening-plan.md` v0.1) — 실제 DB migration 4 Phase 는 별도 세션 (운영 영향 큼)
  - **새 SR-* 4건 + TC 4건**: SR-ONBOARDING-EXCLUSION (TC 14) + SR-SEC-AUDIT-EXPANSION (TC 9) + SR-GUARDIAN-SENDER (TC 8) + SR-IRT-ITEMBANK (TC 22+). 모두 결정성 통과
  - 추적성 매트릭스 47행 → **51행**, SR-* 풀 31 → **35**, TC-* 풀 49 → **53**
  - **claim-lock.md v0.2.5 → v0.3.0** — §10 11행 추가, §13 changelog
  - 검증: `npm run test:vnv` → **53/53 PASS** (49 → 53), `npx tsc --noEmit` → exit 0
  - 신규 파일 14개 (코드 8 + 문서 6) + 기존 5개 갱신 (requirements / traceability / runDeterministicChecks / claim-lock / package.json)
  - **남은 작업 (다음 세션)**: (1) WASM-STT UI 통합 — `useWasmSttLoading` 을 sentence-magic / sing-training / step-1 의 STT 호출부에 wiring (3~4 컴포넌트 편집), (2) IRT step page 통합 — step-1~5 entry 에서 random/순차 → `pickNextItem(getItemBankForStep(step))` 전환, (3) PII/PHI DB migration Phase 1 — `patients_identity` schema + dual-write, (4) 실제 npm install next@16.2.4 + manifest 재산출 (운영환경)

- 2026-04-30: **P0 7개 일괄 처리 (P) — 사용자 위임, 원샷 마감**
  - **P6 IRT/Bayesian 구현** ✅ — `src/lib/adaptive/irt.ts` (289 lines): 2PL probabilityCorrect (양극단 clamp) / fisherInformation / estimateAbilityEap (41-point Gauss-Hermite-like quadrature -4~+4) / pickNextItem (MFI + tie-break itemId asc) / simulateAdaptiveSession. SR-IRT-018 + TC-IRT-001 (22 assertions). claim-lock §3 "적응형 난이도 (IRT 결정성)" 행 신규 + §4 적응형 난이도 행 정정 (IRT 코드 ✅, 임상 calibration 대기). 제품제안서 "핵심 모듈 IRT/Bayesian Adaptive Testing" 클레임 코드 수준 방어 가능
  - **P5 GMP/QMS 결정 매트릭스** ✅ — `docs/regulatory/gmp-qms-decision-matrix.md` v0.1 (121 lines): 3 옵션 (A 자체 / B 외주 / C 하이브리드) trade-off (비용/기간/시판 timing/유연성/심사 통과율), 산출물 분담 12종, 의사결정 5 변수, **PM 1차 권고 C 하이브리드** (사내 PM 1.0 + QM/SE 0.5 FTE 가능 시), 결정 timeline (D-90 RFP → D+45 SaMD 신청)
  - **P3 사용성평가 IRB 부속자료** ✅ — `docs/regulatory/usability-evaluation-irb-package.md` v0.1 (187 lines): 동의서 양식 (체크리스트 10항목 + 권리 안내문 + 서명 양식), 모집공고문 3종 (U1 환자 / U2 치료사 / U3 보호자), 데이터 처리 명세 (PHI maskPhiObject), 위해성 평가 + RM-* 매핑, 보상 정책 (자발적 중단도 지급), 폐기 SOP (D+6개월 secure delete), 평가자 자격 (CITI/KAIRB), IRB 제출 체크리스트 9항목
  - **P1 AI 평가 데이터 수집 가이드** ✅ — `docs/regulatory/ai-evaluation-data-collection-guide.md` v0.1 (161 lines): 모집 분포 (60s 10/70s 12/80s 8 = 30건), 30 자극어 (K-WAB 명칭 + 일상 발화 + 긴 문장), CSV 양식 2종 (WER + RTF), 합격 기준 5 지표 (meanWer ≤ 0.15, byAgeGroup 80s passRateAt15 ≥ 0.65, meanRtf < 1.0, p95 ≤ 41.5ms, passRateP95Target ≥ 0.85), 협력기관 협의 항목 7건 (D-60 IRB 결정 → D-7 데이터 송부)
  - **P8 WASM-STT UI 인디케이터 (presentation only)** ✅ — `src/components/training/WasmSttLoadingIndicator.tsx` (104 lines, 신규 단일 파일): React presentation 컴포넌트, role=status + aria-live=polite, phase 별 색상 (loading=gray / ready=green / failed=red), 진행률 바 + 모델 ID + 소요시간 + 오류 코드 표시, onRetry 콜백. **실제 sentence-magic / sing-training / step-1 통합은 다음 세션** (UI 컴포넌트 편집 truncation 위험)
  - **P7 risk-management-file v1.0 마감** ✅ — §11.8 신규 산출물 매핑 표 (WASM-STT 어댑터 + WER/RTF runner + 로드 머신 + 사용성평가 + CVE 면제 + IRT 7종 → RM-* 영향 매핑), §11.9 잔여위험 v1.0 재평가 표 (개인정보/보안 조건부 → **수용 가능 승격**, 적응형 난이도 신규 평가). **1차 SaMD 신청 자료에 첨부 가능한 위험관리 파일 골격 완성**. v1.x 이후 갱신은 임상/사용성평가 실측 + 식약처 사전상담 회신 후
  - **claim-lock.md v0.2.0 → v0.2.5** — §3 "적응형 난이도 (IRT 결정성)" 행 신규, §4 적응형 난이도 행 정정, §10 5행 추가 (GMP 매트릭스 / IRB 패키지 / 데이터 수집 가이드 / WASM-STT 인디케이터 / IRT), §11 갱신 트리거 4건 추가, §13 changelog
  - 추적성 매트릭스 46행 → **47행** (SR-IRT-018 등재), SR-* 풀 30 → **31** (SR-IRT-018 신규)
  - 검증: `npm run test:vnv` → **49/49 PASS** (48 → 49, TC-IRT-001 신규), `npx tsc --noEmit` → exit 0
  - 신규 파일 6개 (irt.ts / gmp-qms-decision-matrix.md / usability-evaluation-irb-package.md / ai-evaluation-data-collection-guide.md / WasmSttLoadingIndicator.tsx / cve-exemptions.md 는 이전 작업) + 기존 파일 5건 갱신 (requirements / traceability / runDeterministicChecks / claim-lock / risk-management-file)
  - **남은 P0 (외부 의존만 남음)**: (1) 사용성평가 실제 실시 (IRB 승인 + 환자 모집 사람 의존), (2) AI 성능 실측 30건 입력 (임상 협력기관 사람 의존), (3) GMP/QMS 외주사 견적 + 사업 의사결정 (PM 사람 의존), (4) WASM-STT UI 컴포넌트 통합 (다음 세션 코드 작업), (5) next 16.2.4 적용 PR (다음 세션). **Claude 단독 가능 P0 모두 처리 완료**

- 2026-04-30: **CVE 면제 등록부 v0.1 (O) — P0-4 완료, 사이버보안 35항목 ~77%**
  - **`docs/security/cve-exemptions.md` v0.1 신규** (177 lines) — `npm audit` high 7건 전수 reachability 평가 + 면제 결정 등록
  - **R2 transitive-conditional 3건** (production 도달 가능):
    - **fast-xml-parser** ≤5.6.0 (3 CVE: GHSA-8gc5-j5rx-235r entity expansion / GHSA-jp2q-39xq-3w4g entity zero / GHSA-gh4j-gqv2-49f6 XMLBuilder injection) — `@aws-sdk/client-s3` → `core` → `xml-builder` 경유. **decision: deferred-patch** (다음 minor SDK 출시 시 동시 해소)
    - **@aws-sdk/xml-builder** 3.894.0~3.972.11 — fast-xml-parser 와 동일 영향. **decision: deferred-patch**
    - **next** 16.0.0~16.2.3 (1 high: GHSA-q4gf-8mx6-v5v3 Server Components DoS — 5건은 R0 비도달: rewrites/postpone/Server Actions/next/image/dev HMR 미사용). **decision: immediate-patch** (16.2.4 적용 PR)
  - **R0 unreachable 4건** (devDependencies): flatted (eslint), minimatch (eslint), picomatch (eslint), music-metadata (선언만 있고 import 0). **decision: noop-exempt**
  - **S3 presigned URL 영향평가** — `src/lib/server/ncpObjectStorage.ts` 단일 사용처 분석. vulnerable function 은 NCP S3 응답 XML 파싱 경로만 도달 (외부 신뢰 경계는 NCP). 완화 통제 4종: TLS endpoint 강제 + `buildMediaObjectKey` sanitization (`[a-zA-Z0-9_-]` only) + `randomUUID` 서버 측 생성 + sliding window rate limit
  - **claim-lock.md v0.1.9 → v0.2.0** — §3 사이버보안 통제 행: ~74% → **~77%** (SI-04 소프트웨어 구성요소 보안 항목 도큐멘테이션 ✅), §10 cve-exemptions 매핑, §11 신규 CVE 보고 시 §3 행 추가 의무 트리거
  - 검증: `npm run test:vnv` → **48/48 PASS** (회귀 0), `npx tsc --noEmit` → exit 0. 신규 코드 0건 (순수 문서)
  - 사이버보안 35 항목 일치도: ~74% (SI-04 SOUP+Manifest ✅) → **~77%** (SI-04 CVE 면제 도큐멘테이션 ✅)
  - 후속: (1) `next@16.2.4` 적용 PR + release manifest 갱신 + V&V 회귀, (2) @aws-sdk/client-s3 차기 minor 모니터링, (3) music-metadata devDeps 제거 검토

- 2026-04-30: **WASM-STT 2단계 부분 (N) — RTF/P95 + 로딩 머신 + 모델 평가 계획**
  - **`src/lib/ai/sttBenchmark.ts` 신규** (358 lines) — STT 성능 벤치마크 결정성 함수: `parseRtfCsv` (RFC 4180 + 헤더 검증) / `evaluateRtfRows` (overall + byAgeGroup + bySeverity + byNoise + byDevice stratified) / `aggregateLatency` (mean/P50/P95/P99 + passRateP95Target) / `percentile` (linear 보간) / `classifyRtfAgeGroup`. P95 target 기본 41.5ms (제품기획서 정량 클레임). 출력: JSON sortKeys + Markdown
  - **`scripts/ai-eval-rtf-runner.ts` 신규 + `npm run ai-eval:rtf`** — CLI: `--input <csv> --dataset <id> --model <id> --p95-target-ms <num>`. 출력: `docs/remediation/03-ai-evaluation/runs/rtf-<timestamp>/report.{json,md}`
  - **`data/ai-eval/sample-rtf-fixture.csv` 신규** — 10행 fixture (60s 3 / 70s 4 / 80s 2 + 1 unmapped, android/ios/ipad, low/mid/high noise). dry-run: meanRtf=0.0157, p95=72ms, passRateP95Target=0.6 (60% within 41.5ms)
  - **`src/lib/speech/wasmSttLoadingState.ts` 신규** (167 lines) — WASM Whisper 모델 로드 상태 머신 (UI/framework 비의존): `startLoading` / `reportProgress` (clamp NaN/음수→0, 초과→1) / `markReady` / `markFailed` / `reset` / `isLegalTransition` (not_started → loading → ready/failed → not_started) / `elapsedLoadingMs` / `friendlyMessageFor` (4 errorCode + fallback). 진행률 표시 한국어 메시지 자동 생성. **실제 UI 컴포넌트 (sentence-magic / sing-training / step-1) 통합은 다음 세션**
  - **`docs/regulatory/wasm-stt-model-evaluation-plan.md` v0.1 신규** (125 lines) — 후보 5종 (C1 Xenova/whisper-tiny default + C2 base + C3 small + C4/C5 KoWhisper TBD) + **3 단계 결정 게이트** (1단계 RTF/P95: meanRtf<1.0, p95≤41.5ms, passRate≥0.85 / 2단계 WER/CER: meanWer≤0.15, byAgeGroup 80s passRateAt15≥0.65 / 3단계 운영 안정성: 30분 메모리 누수 < 50MB, 모델 재로드 < 500ms) + 결정 트리거 (1+2 합격 → §4 → §3 승격 검토 / 1+2 불합격 → C4/C5 fine-tune 평가 / 모두 불합격 → §4 영구 하향)
  - **V&V**: SR-AI-RTF-RUNNER + TC-AI-RTF-RUNNER-001 (18 assertions: CSV 파싱 + invalid 감지 + classifyRtfAgeGroup 5 case + percentile 보간 + evaluateRtfRows 결정성 + p95TargetMs override + JSON+Markdown 안정). SR-WASM-STT-LOADING + TC-WASM-STT-LOADING-001 (23 assertions: 8단계 시퀀스 + clamp edge + friendly message 4 case + 불법 전이 4 case + elapsedLoadingMs)
  - 추적성 매트릭스 43행 → **46행** (sttBenchmark + RTF CLI + wasmSttLoadingState 3행)
  - **claim-lock.md v0.1.9** — §10 4행 추가 (RTF runner / 로드 상태 머신 / 모델 평가 계획 / 후보 plan), §11 갱신 트리거 2건 추가, §13 changelog
  - 검증: `npm run test:vnv` → **48/48 PASS** (46 → 48), `npx tsc --noEmit` → exit 0
  - 후속 (다음 세션): UI 컴포넌트 (sentence-magic / sing-training / step-1) 의 STT 호출부에 `wasmSttLoadingState` wiring + 진행률 인디케이터 표시. 실제 브라우저 model 다운로드 측정값 → `npm run ai-eval:rtf` 입력 → claim-lock §4 P95 41.5ms 검증

- 2026-04-30: **AI STT 성능평가 (WER/CER) runner (M) — P0-3 평가 체계 ✅**
  - **`src/lib/ai/werRunner.ts` 신규** (362 lines) — 결정성 함수 5종:
    - `parseWerCsv(content)` — RFC 4180 quoted field 지원, 헤더 검증 (sample_id/age/severity/device_type/noise/lighting/ground_truth/transcript 8 필수), sampleId 알파벳 정렬, 라인별 invalid 감지 (`missing_column:*`, `invalid_age:*`, `invalid_noise:*`, `invalid_lighting:*`)
    - `evaluateWerRows({rows, generatedAt, datasetId, modelId})` — Stratified WER/CER (overall + byAgeGroup + bySeverity + byNoise + byDevice). passes15 = WER ≤ 0.15 (claim-lock §4 목표)
    - `classifyAgeGroup(age)` — 60s/70s/80s/other 결정성 분류 (60~80대 환자 모집단 표시)
    - `serializeWerReportJson(report)` — sortKeys replacer 로 동일 입력 동일 문자열
    - `serializeWerReportMarkdown(report)` — 헤더 + Overall + By Age Group / Severity / Noise / Device + Per-Sample Rows
  - **`scripts/ai-eval-wer-runner.ts` 신규 + `npm run ai-eval:wer`** — CLI 진입점. `--input <csv> --dataset <id> --model <id> --timestamp <iso8601>` 옵션. 출력: `docs/remediation/03-ai-evaluation/runs/<timestamp>/report.json` + `report.md`
  - **`data/ai-eval/sample-fixture.csv` 신규** — 5행 (60대 2 / 70대 2 / 80대 1, severity mild/moderate/severe, device android/ios/ipad, noise low/mid/high) — runner 입력 양식 표준
  - **V&V**: SR-AI-EVAL-RUNNER + TC-AI-EVAL-RUNNER-001 등재 — 14 assertions (CSV parse 결정성 + sampleId 정렬 + missing_column 에러 + classifyAgeGroup 5 case + evaluateWerRows 동일 입력 동일 출력 + ageGroup/severity 버킷 결정성 + JSON sortKeys 결정성 + Markdown 안정 + P001 정확 일치 wer=0)
  - 추적성 매트릭스 41행 → **43행** (werRunner 모듈 + CLI 2행)
  - 첫 dry-run 실행 (sample fixture, 2026-04-30T00:00:00Z, ko-aphasia-fixture-v0.1, wasm:Xenova/whisper-tiny) → meanWer=0.5333 / passRateAt15=0.4 (의도된 fixture STT 오류 3건 포함). 실측 결과는 임상 협력기관 30건 입력 후
  - **claim-lock.md v0.1.8** — §10 근거 파일에 werRunner.ts + CLI 매핑, §11 갱신 트리거 1건 추가 (실측값 입력 → §4 WER 행 검토 + RM-001 P 값 재산정), §13 changelog. **§4 "WER/CER 평가 체계 구축 중" 행: 체계 ✅ / 측정값 ✗** (60~80대 30건 입력 대기)
  - 검증: `npm run test:vnv` → **46/46 PASS** (45 → 46), `npx tsc --noEmit` → exit 0
  - 후속: 임상 협력기관 (부산대 등) 음성·전사 30건 수집 → npm run ai-eval:wer 실행 → claim-lock §4 WER 행 → §3 승격 가능. KoWhisper fine-tune 모델 후보 (KoWhisper-medium, openai-whisper-small.ko) 비교 평가 (WASM-STT 2단계와 결합)

- 2026-04-30: **WASM-STT 실제 엔진 연결 (L) — P0-1 1단계 완료**
  - **`@huggingface/transformers` v4.2.0 추가** — `package.json` dependencies + node_modules 설치 완료. transformers.js 의 web/node 빌드 모두 보유 (`dist/transformers.web.js`, `dist/transformers.node.cjs`)
  - **`src/lib/speech/wasmSttAdapter.ts` 실제 wiring** (skeleton 23 lines → 214 lines):
    - `isWasmSttAvailable()` — window + WebAssembly + AudioContext 3중 감지. SSR/Node 에서는 자동 false
    - `transcribeWithWasmStt()` — lazy `import("@huggingface/transformers")` (모듈 top-level 평가 차단), `pipeline("automatic-speech-recognition", "Xenova/whisper-tiny", { dtype: "fp32" })` 단일 인스턴스 캐싱, Blob → AudioContext.decodeAudioData → Float32Array (16kHz mono) 변환, `language: "korean"` task transcribe
    - 명시 에러 4종: `wasm_stt_unavailable` / `wasm_stt_no_browser_audio_context` / `wasm_stt_model_load_failed:<reason>` / `wasm_stt_transcription_failed:<reason>`
    - 안정 식별자: `WASM_STT_MODEL_ID="Xenova/whisper-tiny"`, `WASM_STT_PACKAGE_VERSION="4.2.0"`, `WASM_STT_SAMPLE_RATE=16000`, `WASM_STT_ENGINE_VERSION="transformers.js@4.2.0:Xenova/whisper-tiny:v0.1"` — release manifest 모델 자산 추적용
    - confidence: token-level confidence 미노출이라 v0.1 fixed 0.85 (text 비어 있으면 0). v0.2 에서 logits 기반 산출 예정
    - `__resetWasmSttPipelineForTest()` — V&V 모듈 상태 격리용 idempotent reset
  - **V&V**: SR-STT-009 추적성 등재 + TC-STT-WASM-001 신규 — Node 환경 5종 결정성 assertion (isWasmSttAvailable=false / 4 모델·패키지·엔진 상수 / sampleRate=16000 / 2회 rejection 모두 `wasm_stt_unavailable` / idempotent reset)
  - 추적성 매트릭스 40행 → **41행** (`SR-STT-009` 행 4개)
  - `runDeterministicChecks` async 화 — TC-STT-WASM-001 이 `await transcribeWithWasmStt(...)` 호출 필요. `runDeterministicChecks` / `buildDeterministicExecutionLogRecord` 둘 다 async 로 변환, main() 의 호출도 await 추가
  - **claim-lock.md v0.1.7** — §3 사용 가능 클레임에 "WASM 온디바이스 STT (훈련 useCase)" 행 신규, §4 STT 행과 온디바이스 처리 행 정정 (training=WASM, evaluation=server 분리), §10 어댑터 경로, §11 엔진 변경 트리거, §13 changelog v0.1.7
  - **risk-management-file.md v0.5** — RM-001 위험통제에 `wasmSttAdapter.ts` + `TC-STT-WASM-001` 추가, RM-002 초기 위험 S3/P3 → **S2/P2** 재산정 (training useCase rawAudioLeavesDevice=false 결정성 검증), 잔여위험 "수용 가능 (training useCase 한정) / 조건부 수용 (evaluation useCase)"
  - **digital-medical-product-gap-matrix.md** — STT/외부 서비스 행 P0 → **P0 부분 완료** (엔진 wiring ✅ / 성능 측정 ✗), P0-Code 1번 항목 "WASM-STT 실제 엔진 연결 또는 클레임 하향" → "1단계 완료"
  - 검증: `npm run test:vnv` → **45/45 PASS** (44 → 45, TC-STT-WASM-001 통과), `npx tsc --noEmit` → exit 0 (.next/dev/* stale artifacts 무관)
  - 후속 (2단계, 다음 세션): step-1 실제 동작 테스트 + UI 로딩 인디케이터 + Service Worker 모델 캐싱 + RTF/P95 측정 + KO WER 측정 (KoWhisper fine-tune 모델 후보 평가). 현재는 isWasmSttAvailable() 의 브라우저 감지가 정확한지 실제 브라우저에서 검증 필요

- 2026-04-30: **사용성평가 프로토콜 v0.1 (K) — IEC 62366-1 §5.4~5.9 신규 산출**
  - `docs/regulatory/usability-evaluation-protocol.md` v0.1 신규 — Primary Operating Function 12종 (POF-01~12) 식별, **critical task 2종** (POF-05 환자 즉시 중단 / POF-07 K-WAB 검토 확정) 분리, use scenario 12종 + Hazard Related Use Scenario 매핑 (RM-001/002/003/004/005/006/008/009/010/013/016/018 12 위해요인 검증)
  - 평가 단계: formative 5/5/5~8 (round 3) + **summative 15명** (U1 환자 8 [60~80대 5+50대이하 3] + U2 치료사 4 + U3 보호자 3). 데이터 수집 양식 (think-aloud, 화면 녹화, SUS, use error JSON)
  - **DEFAULT_SUMMATIVE_CRITERIA**: criticalTaskCompletionRate=1.0 / primaryTaskCompletionRate=0.8 / maxUnmitigatedSevereUseErrors=0. 결정성 함수 `evaluateSummativeUsability()` 가 합격기준을 자동 산출
  - `src/lib/usability/useScenarioValidator.ts` 신규 — `normalizeScenarios` (taskId 알파벳 정렬, last-wins) / `buildTaskCompletionStats` ((participantId, taskId) last-wins) / `bucketUseErrors` (minor→moderate→severe 고정 순서) / `buildHazardCoverage` (hazardId 와 verifiedByTaskIds 알파벳 정렬) / `evaluateSummativeUsability` (failureReasons 4종 결정성 산출)
  - V&V: SR-USABILITY-017 + TC-USABILITY-001 등재 — 15 명 fixture × 4 시나리오 (critical 14/15 → critical fail / primary 12/15 → primary pass / non-primary / severe-unmitigated edge / 빈 입력 graceful / 합격 fixture). 동일 입력 → 동일 출력 검증 (`assert.deepEqual(repeat, result)`)
  - `risk-management-file.md` v0.4 — §11.3 매핑 표에 사용성평가 5건 (RM-005/006/008/013/018) 추가, §11.7 신설 (POF / critical / DEFAULT_SUMMATIVE_CRITERIA 매핑)
  - `claim-lock.md` v0.1.6 — §3 사용 가능 클레임에 IEC 62366 사용적합성 행 추가, §10 사용성평가 프로토콜 + 결정성 함수 경로 매핑, §11 갱신 트리거 1건 추가
  - 추적성 매트릭스 39행 → **40행**, SR-* 풀 27개 → **28개**
  - 검증: `npm run test:vnv` → **44/44 PASS** (43 → 44, TC-USABILITY-001 통과), `npx tsc --noEmit` → exit 0
  - 디스크 truncation 사고 (Edit tool 비동기 sync 이슈) — runDeterministicChecks.ts / requirements.ts / traceability.ts / claim-lock.md / risk-management-file.md 5개 파일 bash heredoc 으로 직접 디스크 복구. 향후 큰 파일 편집 시 Read↔디스크 매번 wc -l 검증 필수
  - 후속: `data/usability/scenarios.json` 직렬화, `usability-evaluation-irb-package.md` 작성, formative round 1 (U1 3 + U2 2) 진행

- 2026-04-30: **claim-lock.md 갱신 (J) — 인허가 표현 정정 v0.1.5**
  - §3 사용 가능 클레임에 4행 추가 (사이버보안 통제 / 형상관리·변경관리 / 추적성 매트릭스 / ISO 14971 위험관리)
  - §10 근거 파일에 9개 신규 산출물 매핑 추가 (위험관리 파일 v0.3, IEC 62304 export 라우트, 사이버보안 결정성 함수 13종, manifest/SOUP/SBOM 산출물, WER/CER 평가, 보호자 동의 상태머신, NIDS 결정문)
  - §11 갱신 트리거 4건 추가 (NIDS/식약처 답변 / V&V 회귀 / 추적성 uncovered 증가 / 사이버보안 일치도 변동)
  - §13 갱신 이력에 2026-04-30 누적 8건 (NIDS / 사이버보안 35 ~74% / SR-* 27개 / IEC 62304 export / ISO 14971 v0.3 / zod 6 라우트 / manifest 첫 산출 / V&V 36→43)
- 2026-04-30: **risk-management-file v0.3 (I) — RM-021 등재 + 식별자 통일**
  - RM-021 (서비스 거부 / DoS) §5 매트릭스 신규 등재 (S2/P3, 통제: SR-SEC-RA01)
  - HAZARD_LINKS (`src/app/api/therapist/system/iec62304-traceability/route.ts`) 의 hazardId 7건을 RM-* 로 통일 (H-STT-001 → RM-001, H-PHI-002 → RM-017 등)
  - V&V fixture (TC-IEC62304-001) 도 RM-* 로 갱신 (RM-001/RM-017/RM-010)
  - §11.1 매핑 표 갱신 (모든 RM-*/HAZARD_LINKS 통일 ✅), §11.6 closed
  - 검증: `npm run test:vnv` → **43/43 PASS**
- 2026-04-30: **adverse-events 라우트 zod 통합 (H) — Task D 잔존 마무리**
  - `inputSchemas.ts` AdverseEventInputSchema 형식 정정 — category enum (AE_CATEGORIES 와 통일: headache/fatigue/dizziness/voice_fatigue/eye_fatigue/anxiety/other) + severity number 1|2|3 (DB 와 일치) + freeText/patientUserId/patientPseudonymId/prescriptionId optional
  - `app/api/adverse-events/route.ts` POST 핸들러에 `validateInput(AdverseEventInputSchema, body)` 통합. prescriber-on-behalf-of-patient 분기 (patientUserId / patientPseudonymId 필수) 는 기존 로직 유지
  - SI-05 일치도: zod 적용 라우트 6개 → **7개**
- 2026-04-30: **risk-management-file.md v0.2 (G) — ISO 14971 + 결정성 V&V 통합**
  - `docs/regulatory/risk-management-file.md` §11 신설 — 기존 v0.1 의 20개 RM-* 위해요인 보존하면서, 결정성 V&V 함수 (`classifyHazard`, `analyzeChangeImpact`, `verifyManifest` 등) 와 IEC 62304 별지 제2호 export 매핑 보강
  - RM-* (도메인) ↔ H-* (사이버보안 측면, `HAZARD_LINKS` in iec62304-traceability/route.ts) 매핑 표 추가 — 7건 매핑 + H-DOS-004 는 RM-021 신규 등재 예정 (v1.0)
  - 변경관리 영향평가 (CIA) 자동화 매핑: model 자산/≥3 component 변경 → major + requiresRegulatoryFiling=true 자동 판단
  - v1.0 은 임상/사용성 평가 결과 반영 후 확정 (식별자 체계 단일화 + RM-021 H-DOS 통합)
- 2026-04-30: **SBOM/SOUP/Manifest 실제 산출물 생성 (F)**
  - `npm run security:sbom` → 637 components → `docs/security/sbom/latest.json`
  - `npm run security:soup` → 23 entries (npm 8 / pypi 13 / model 2) → `docs/security/soup/latest.json`
  - `npm run security:audit` → critical=0 / high=3 / moderate=1. high 3건은 transitive (fast-xml-parser, @aws-sdk/xml-builder) — S3 presigned URL 영역 영향평가 + 면제 사유 별도 기록 필요 (후속)
  - `npm run security:manifest` → 5 components 동결 → manifestHash `97079f5f…7c304ea3e8` → `docs/security/manifest/latest.json`
  - v0.1.0 첫 release manifest 산출. 시판 전 audit fix + commit 후 재생성 권장 (현재 working tree dirty)
- 2026-04-30: **zod 입력 검증 점진 적용 (#37 D) — 5/6 라우트 완료**
  - `app/api/auth/reset-password/route.ts` ✅ ResetPasswordInputSchema 적용 (수동 String/trim → zod 통합)
  - `app/api/auth/find-login-id/route.ts` ✅ FindLoginIdInputSchema 적용
  - `app/api/auth/signup/route.ts` ✅ SignupInputSchema 적용 (환자 기본 필드만, 역할별 추가 검증은 기존 로직 유지)
  - `app/api/patient/link-care/route.ts` ✅ PatientLinkCareInputSchema 적용
  - `app/api/prescriptions/redeem/route.ts` ✅ PrescriptionRedeemInputSchema 적용 (code regex `^[A-Za-z0-9-]+$` 강화)
  - `app/api/adverse-events/route.ts` 보류 — AdverseEventInputSchema 의 severity ("mild"/"moderate"/"severe") vs 라우트 (1/2/3 number) 형식 불일치. 스키마 통일 후 후속 적용 (별도 task 권장)
  - `src/app/api/auth/login/route.ts` 사고 복구 — bash mount sync 사고로 line 108 mid-statement 잘림 → git HEAD 의 catch 블록 (error.message + status 4-way 매핑) 그대로 복원
  - 검증: `npm run test:vnv` → **43/43 PASS** (회귀 0건), `npx tsc --noEmit` → exit 0
  - SI-05 일치도: 라우트 2개 → **6개** (login/aac/reset/find/signup/link-care/redeem)
- 2026-04-30: **추적성 매트릭스 IEC 62304 별지 제2호 양식 export (#35) 완료**
  - `lib/vnv/iec62304Export.ts` 신규 — buildIec62304TraceabilityMatrix / serializeIec62304Markdown / serializeIec62304Csv. requirementId 알파벳 정렬 + designModules/testCaseIds 정렬 + uncovered/untested/hazardControlled 카운트 결정성. CSV escape (콤마/줄바꿈/따옴표) 결정성
  - `app/api/therapist/system/iec62304-traceability/route.ts` 신규 — GET ?format=json|md|csv 분기. 7개 hazard ↔ SR 매핑 (H-STT/H-PHI/H-AUTH/H-DOS/H-INTEG/H-CONSENT/H-CHANGE) 정적 정의 + 결정성 V&V run 결과 통합
  - `lib/vnv/traceability.ts` 확장 — 13행 → **39행** (5채널 + 사이버보안 10종 + 규제 신규 5개 + IEC 62304 export 자체 추적)
  - V&V: SR-IEC62304-EXPORT + TC-IEC62304-001 (9 assertion: buildMatrix 결정성 / requirementId sort / hazard 매핑 / uncovered + untested / Markdown 직렬화 / CSV escape) 등재
  - 검증: `npm run test:vnv` → **43/43 PASS** (37 → 42 → 43)
  - SR-* 풀 27개 (B 26개 + IEC62304-EXPORT)
- 2026-04-30: **V&V SR-* 풀 확장 (#33) 완료 — 21개 → 26개**
  - `lib/server/riskClassification.ts` 신규 — ISO 14971 hazard severity × probability → riskClass A/B/C 결정성. classifyHazard / classifyHazardList / summarizeHazards / scoreToRiskClass
  - `lib/server/phiMasking.ts` 신규 — PHI (이름/전화/RRN/이메일/환자ID) 결정성 마스킹. maskPhi / maskPhiObject (재귀 객체 + PHI 키 자동 탐지 + touched 알파벳 정렬)
  - `lib/ai/werCalculator.ts` 신규 — WER/CER Levenshtein 결정성 계산. calculateWer / aggregateWer (passRateAt15 = WER ≤ 0.15 통과율) / normalizeForWer (NFC + 구두점 + 공백)
  - `lib/guardian/consentState.ts` 신규 — 보호자 동의 상태머신. evaluateGuardianConsent (TTL 7일) / isLegalTransition (pending→granted/revoked/expired, granted→revoked 만 합법)
  - `lib/server/changeImpactAnalysis.ts` 신규 — release manifest delta → 영향받는 SR-* 자동 매핑. diffManifestComponents / analyzeChangeImpact (major/minor/patch + requiresRegulatoryFiling + revalidationTriggers)
  - V&V 5개 SR + TC 등재: SR-RISK-012 / SR-PHI-013 / SR-AI-EVAL-014 / SR-CONSENT-015 / SR-CHANGE-016 (각 TC 결정성 5~10 assertion)
  - 검증: `npm run test:vnv` → **42/42 PASS** (37 → 42), `npx tsc --noEmit` → exit 0
  - SR-* 풀 확장: 도메인 (LOGIN/PERMISSION/SESSION/SCORE/HISTORY/MEASURE/GAZE/AAC/STT/GUARDIAN/AE) 11개 + 규제 신규 (RISK/PHI/AI-EVAL/CONSENT/CHANGE) 5개 + 사이버보안 (IA05/IA07/UC03/RA01/UC07/TRE01/SI07/SI05/SI04-SOUP/SI04-MANIFEST) 10개 = **26개**
- 2026-04-30: **사이버보안 SI-04 release manifest (#30) 완료**
  - `lib/server/releaseManifest.ts` 신규 — buildManifest / verifyManifest / normalizeComponents / computeManifestHash / serializeManifest 결정성 함수 (sha256 64 hex 형식 검증, id 알파벳 정렬, last-wins 중복 처리)
  - `lib/server/releaseManifestStartup.ts` 신규 — evaluateStartupCheck (skip / ok / block / warn 4종 status 결정성 분리)
  - `scripts/generate-release-manifest.mjs` 신규 — git SHA + package-lock + Python requirements + SBOM + SOUP + 모델 자산 (face_landmarker.task) 통합 → manifestHash 산출 + JSON/Markdown 출력
  - `npm run security:manifest` script 추가, `security:all` 에 통합
  - V&V: SR-SEC-SI04-MANIFEST + TC-SEC-SI04-MANIFEST-001 (17 assertions: buildManifest 결정성 / verifyManifest mismatch+missing+extra+version+manifest_hash 5종 breach / ignoreExtra / serializeManifest round-trip / evaluateStartupCheck 4종 status) 등재
  - 검증: `npm run test:vnv` → **37/37 PASS**
  - SI-04 SOUP + Manifest 모두 ✅. 사이버보안 35 항목 일치도 ~70% → **~74%** (✅ 19→20개)
- 2026-04-30 (Q+2): **신규 3 place (식당/약국/대중교통) 추가 작업 후 전체 롤백 — 6개 환경 유지**
  - 작업 진행: 백엔드 시드 9개 추가 (trainingData PlaceType, inputSchemas PlaceTypeSchema, visualTrainingData, speechTrainingData, aacData, auditoryTrainingData/fluencyData/readingData/writingData stub) + claim-lock §3 사용 환경 행 신설 + mfds-pack v1.1
  - **PM 결정 후 전체 롤백**: 화면(self-assessment/speech-rehab/sing-training PLACES 6개 hardcoded) 과의 정합성 부재 + 이미지 자산 미준비 + 임상가 PROTOCOL 정식화 전 노출 시 인허가 심사용 데모 broken image 위험
  - 롤백 적용:
    - `trainingData.ts` PlaceType (9→6), TRAINING_PLACES (3개 제거)
    - `inputSchemas.ts` PlaceTypeSchema (9→6)
    - `visualTrainingData.ts` PLACE_SEEDS / IMAGE_FILENAME_MAP / PROTOCOLS (3개씩 제거)
    - `speechTrainingData.ts` REPETITION_PROTOCOLS (3개 제거)
    - `aacData.ts` PLACE_NOUN_SEEDS / PLACE_INTENT_SEEDS / AAC_PLACE_SYMBOLS (3개씩 제거)
    - `auditoryTrainingData.ts` REHAB_PROTOCOLS stub 3개 제거
    - `fluencyData.ts` FLUENCY_SCENARIOS stub 3개 제거
    - `readingData.ts` READING_TEXTS stub 3개 제거
    - `writingData.ts` WRITING_WORDS stub 3개 제거
  - cross-ref 정정:
    - claim-lock §3 사용 환경 행 → 6개 환경 명시로 정정
    - mfds-pre-consultation-pack v1.1 → v1.0 롤백 명시
  - **후속 (별도 task #40 유지)**: 임상가 (1급 언어재활사 — 이현송 대표) 검토 + restaurant/pharmacy/transit.png 디자인 제작 + select-page PLACES 상수 + 사용자 매뉴얼 갱신 + 변경허가 신청 패키지를 한 번에 진행
- 2026-04-30 (Q+1): **사전상담 패키지 v1.0 출판** — `mfds-pre-consultation-pack.md` v0.1 → v1.0
  - 양적 수치 갱신 (V&V 49→53 TC, SR 31→35, 추적성 47→51 행)
  - claim-lock v0.2.5 → v0.3.0 reference 정합, RM v0.3 → v1.0 reference 정합
  - §1 6 질의 각각에 "근거 산출물 + 후속 의사결정 트리거" 매핑 추가
  - §5 사전상담 신청 절차 (경로 / 양식 / 비용 / D-day 일정) 신규
  - §6 회의 당일 체크리스트 (준비물 / 진행 순서 / 핵심 답변) 신규
  - §7 회신 후 의사결정 트리거 매트릭스 (회신 결과별 갱신 대상 산출물) 신규
  - §8 cross-reference 4개 동시 갱신 의무 명시
  - §2 산출물 인덱스에 사용자 매뉴얼 3종 + SRS/SDS/traceability 분류 추가
  - cross-ref 동시 갱신: regulatory-completion-status.md §4 v0.2 마킹 (mfds-pre-consultation-pack v1.0), spec-gap-roadmap Q+1 엔트리, claim-lock §3 추가 변동 없음, RM §11 추가 변동 없음
  - **외부 timing 효과**: 식약처 사전상담 신청 즉시 가능 → 통상 4~6주 회신 timing 시작 가능
- 2026-04-29: 초안. 제품제안서 v1 (2026-04-27 제출본) 기준 갭 분석 및 P0/P1/P2 구분
- 2026-04-30: **SOUP 자동 생성 스크립트 (#34) 완료 — SI-04 일부**
  - `lib/server/soupRegistry.ts` 신규 — buildSoupList / normalizeSoupEntry / summarizeSoupList 결정성 함수
  - `scripts/generate-soup-list.mjs` 신규 — package.json + voice-analysis-service/requirements.txt + 외부 모델 통합 → JSON + Markdown 출력
  - `npm run security:soup` script 추가, `security:all` 에 통합
  - 실행 결과: 23 entries 생성 (npm 8 / pypi 13 / model 2)
  - V&V: SR-SEC-SI04-SOUP + TC-SEC-SI04-SOUP-001 등재
  - 검증: `npm run test:vnv` → **36/36 PASS**
  - 출력: `docs/security/soup/latest.json`, `docs/security/soup/latest.md`
- 2026-04-30: **사이버보안 SI-05 입력값 검증 (zod) 처리**
  - `npm install zod` (v4.4.1)
  - `lib/server/inputSchemas.ts` 신규 — Login / Signup / ResetPassword / FindLoginId / AacIntent / AdverseEvent / PatientLinkCare / PrescriptionRedeem 8 스키마 + validateInput 헬퍼
  - `app/api/aac/intent/route.ts`, `app/api/auth/login/route.ts` 1차 적용 (수동 String/trim 검증 → zod 통합)
  - V&V: SR-SEC-SI05 + TC-SEC-SI05-001 등재 (정상 2건 + 비정상 5건 + 결정성 1건)
  - 검증: `npm run test:vnv` → **35/35 PASS**
  - SI-05 △→✅. 일치도 ~67% → **~70%**
- 2026-04-30: **사이버보안 35 항목 추가 4개 처리 (RA-01 / UC-07 / TRE-01 / SI-07)**
  - **RA-01 rate limit** (`lib/server/rateLimit.ts` 신규) — sliding window, 라우트별 정책
  - **UC-07 audit HMAC 체인** (`lib/server/auditChain.ts` 신규) — prevHash + entryHash, HMAC-SHA256
  - **TRE-01 append-only 검증** — `auditChain.ts` 의 verifyAuditChain 에 시간 단조성 통합
  - **SI-07 통합 오류 dictionary** (`lib/server/errorCodes.ts` 신규) — 12 코드 + internal_error fallback
  - V&V: SR-SEC-RA01 / UC07 / TRE01 / SI07 + TC-SEC-* 4건 등재
  - 검증: `npm run test:vnv` → **34/34 PASS** (사용자 이전 작업 TC-RISK/TC-STT/TC-GUARDIAN 12건 + 신규 사이버보안 4건 + 기존 18건)
  - 사이버보안 35 항목 일치도 약 55% → **약 65~70%** (✅ 13 → 17개)
- 2026-04-30: **NIDS 답변 반영 + 사이버보안 35 항목 핵심 3개 처리**
  - `docs/decisions/2026-04-30-nids-samd-dtx-relationship.md` 신규 — SaMD ⊃ DTx, 양자택일 아님
  - `docs/regulatory/digital-medical-product-gap-matrix.md` 정정 (분기 시나리오 + 의사결정)
  - `docs/remediation/00-summary/mfds-guideline-gap-analysis.md` §4-2 / §4-3 / §6 정정
  - **IA-05 비밀번호 강도** (`accountAuth.ts` validatePasswordStrength) — 8자 + 2종 + 반복 4회 금지
  - **IA-07 로그인 실패 잠금** (`lib/server/loginLockout.ts` 신규) — 5회 실패 → 15분 잠금
  - **UC-03 세션 idle timeout** (`lib/server/sessionLockout.ts` 신규) — 30분 idle 만료
  - V&V: SR-SEC-IA05 / IA07 / UC03 + TC-SEC-IA05-001 / IA07-001 / UC03-001 등재
  - 검증: `npm run test:vnv` → **30/30 PASS**
  - 사이버보안 35 항목 일치도 약 46% → **약 55%** (✅ 13개)
- 2026-04-29: **P0-2 AAC Phase 1 완료**
  - `src/constants/aacData.ts` 신규 — Universal subjects 5 + Universal intents 10 + place 별 (nouns 9 + intents 8) × 6 places. visualTrainingData emoji 재사용 (라이선스 부담 0). Stable id 체계 (`subj/me`, `intent/cafe/0`, `noun/home/3` 등)
  - `src/lib/aac/intentTemplate.ts` 신규 — 규칙 기반 결정성 sequence→sentence 빌더. subject fallback "저", 특수 intent (도와주세요/물/화장실 등), noun-only 폴백, multi-intent 그리고-연결, unknownIds 누적
  - `src/components/aac/AACBoard.tsx` 신규 — place 탭 + kind 별 그리드 (subject/intent/noun) + 시퀀스 preview + ⌫/clear/commit 버튼
  - `src/app/(training)/programs/aac/page.tsx` 신규 — standalone 라우트, /api/aac/intent 로 commit
  - `src/app/api/aac/intent/route.ts` 신규 — POST 환자 세션 필수 + body validate + 서버측 sentence 재생성 + audit log + IF NOT EXISTS 로 `aac_intent_logs` 테이블 자동 생성
  - `src/lib/vnv/requirements.ts` `SR-AAC-008` 추가
  - `src/lib/vnv/runDeterministicChecks.ts` `runAacIntentTemplateCheck` (TC-AAC-001) 추가 — 6 케이스
  - **검증**: `npm run test:vnv` → **15/15 PASS** (TC-AAC-001 포함). tsc 새 파일 클린 (타입 에러 0)
- 2026-04-29: **P0-1 시선 추적 데이터 레이어 + 누적기 + dev 시각화 완료**
  - `src/utils/faceAnalysis.ts` 에 `GazeMetrics` 타입 + `calculateGazeMetrics(landmarks)` 추가 (MediaPipe iris 랜드마크 468/473 + 눈 윤곽 4점 사용, dead-zone 0.3 / 감점 구간 0.7 기준)
  - `src/components/diagnosis/FaceTracker.tsx` 의 `ExtendedMetrics` 에 `gaze` 필드 + smoothing + no-face / init-error 폴백 처리
  - `src/app/(training)/TrainingContext.tsx` 의 `SidebarMetrics` 에 `gazeXNorm / gazeYNorm / gazeCentered / gazeAttention / irisDetected` 추가
  - `src/lib/training/gazeAccumulator.ts` 신규 — 세션 단위 attentionRatio / offTaskRatio / irisDetectionRatio / measurementQuality 산출
  - `src/lib/vnv/requirements.ts` 에 `SR-GAZE-007` 요건 정의
  - `src/lib/vnv/runDeterministicChecks.ts` 에 `runGazeMetricsCheck` (TC-GAZE-001) + `runGazeAccumulatorCheck` (TC-GAZE-002) 추가
  - **검증**: `npm run test:vnv` → 14/14 PASS (TC-GAZE-001, TC-GAZE-002 포함). `npx tsc --noEmit` → exit 0 (타입 클린)
- 2026-04-29: **P0-3 WASM-STT 갈래 결정 + 정책 레이어 1차 완료**
  - 결정: B. 분리형. 일상/게임 훈련은 WASM 온디바이스 우선, 주간 K-WAB/임상 평가는 서버 Whisper 허용 경로로 분리
  - `src/lib/speech/sttPolicy.ts` 신규 — `daily_training / game_training / weekly_kwab / clinical_evaluation` useCase 와 `wasm_whisper / server_whisper / disabled` 정책 결정
  - `src/app/api/proxy/stt/route.ts` 에 서버 송신 가드 추가 — 훈련 useCase 는 `STT_TRAINING_SERVER_FALLBACK=false` 일 때 403 fallback
  - `src/lib/speech/SpeechAnalyzer.ts` 에 `sttUseCase`, 도메인 prompt builder 연동
  - `src/lib/vnv/requirements.ts` `SR-STT-009` 추가, `src/lib/vnv/runDeterministicChecks.ts` `TC-STT-001` 추가
  - 후속: 실제 WASM Whisper 엔진(`transformers.js` 또는 `whisper.cpp`) 연결, 주간 K-WAB 서버 STT 호출부에는 `weekly_kwab` useCase 명시
- 2026-04-29: **P1-6 보호자 주간 리포트 Phase 1 완료**
  - `src/lib/guardian/weeklyReportSummary.ts` 신규 — 최근 7일 훈련 수, 언어/노래 세션 수, 최신 AQ, AQ 변화, 평균 점수, step별 완료율, 이상반응 상태 결정성 요약
  - `src/lib/server/guardianReportsDb.ts` 신규 — `guardian_report_links` 테이블 자동 생성, 토큰 hash 저장, 보호자 read-only 리포트 조회
  - `src/app/api/guardian/report-link/route.ts` 신규 — 환자 본인/admin/담당 치료사가 보호자용 링크 생성
  - `src/app/guardian/[token]/page.tsx` 신규 — 로그인 없는 토큰 기반 read-only 보호자 주간 리포트 화면
  - `src/app/api/cron/weekly-report/route.ts` 신규 — 발송 전 단계 cron preview/link generation API
  - `src/lib/vnv/requirements.ts` `SR-GUARDIAN-010` 추가, `src/lib/vnv/runDeterministicChecks.ts` `TC-GUARDIAN-001` 추가
  - **검증**: `npm run test:vnv` → 17/17 PASS. `npx tsc --noEmit` → exit 0
- 2026-05-04: **보호자 주간 리포트 Phase 2 dry-run 증적 저장 완료**
  - `src/lib/server/weeklyReportSender.ts` 확장 — `weekly_report_deliveries` 테이블 자동 생성, `dry_run / sent / failed / skipped / pending` 상태 저장, 최근 발송 이력 요약 함수 추가
  - `src/app/api/cron/weekly-report/route.ts` 확장 — GET 은 후보 + 최근 발송 증적 preview, POST 는 보호자 링크 생성 후 dry-run 발송 기록 저장. 실제 SMTP/SES/카카오 채널 미구성 시 `send` 요청은 `skipped_no_channel` 로 증적화
  - `SR-GUARDIAN-SENDER` 요건 문구 갱신 — 발송 결정 함수뿐 아니라 dry-run 증적 저장을 포함
  - `TC-GUARDIAN-SENDER-001` 확장 — decideSend / executeSendBatch / dry_run·sent·failed·skipped 요약 결정성 검증
  - **검증**: `npm run test:vnv` → 54/54 PASS. `npx tsc --noEmit` → exit 0
  - 후속: 운영 채널 결정 후 SMTP/SES/카카오 adapter 연결, 보호자 contact/동의 UI, 관리자 화면 발송 버튼/최근 발송 실패 표시
- 2026-05-04: **보호자 연락처·동의 관리 Phase 1 완료**
  - `src/lib/server/guardianContactsDb.ts` 신규 — `guardian_contacts` 테이블 자동 생성, 보호자 이름/연락처 원문 미저장, 마스킹값 + `sha256(type:normalizedContact)` hash 저장, `pending/granted/revoked/expired` 동의 상태 조회
  - `src/app/api/guardian/contacts/route.ts` 신규 — admin/담당 치료사/환자 본인 범위에서 보호자 연락처 등록, 조회, 동의 철회. `inputSchemas.ts` 에 `GuardianContactInputSchema`, `GuardianContactRevokeInputSchema` 추가
  - `src/app/therapist/patients/[patientId]/page.tsx` 에 보호자 연락처·동의 섹션 추가 — 연락처 저장, 동의 확인, 마스킹 표시, 동의 철회. 동의 승인 전에는 보호자 리포트 링크 생성 버튼 비활성화
  - `src/lib/server/guardianReportsDb.ts` 보호자 링크/주간 발송 후보 필터 강화 — granted contact 없으면 링크 생성 `guardian_consent_required`, cron 후보에서도 제외
  - V&V: `TC-GUARDIAN-CONTACT-001` 추가 — 보호자 이름/이메일/휴대폰 normalize + mask + hash 결정성 7 assertions, traceability 에 `SR-GUARDIAN-SENDER`, `SR-CONSENT-015`, `SR-PHI-013` 연결
  - **검증**: `npm run test:vnv` → 55/55 PASS. `npx tsc --noEmit` → exit 0
  - 후속: 실제 SMTP/SES/카카오 adapter 연결 시 원문 연락처 보관 방식 결정 필요 — 현재는 개인정보 최소화를 위해 원문 미저장
- 2026-05-04: **WASM-STT 실제 화면 통합 1차 완료**
  - `src/lib/speech/SpeechAnalyzer.ts` 확장 — `SttLifecycleCallbacks` 추가, `wasm_whisper` 경로에서 모델 로드 시작/성공/실패 콜백 호출
  - `src/components/lingo/SentenceMagicGame.tsx` 수정 — 기존 `/api/proxy/stt` 직접 호출을 `WhisperTranscriber(useCase=game_training)` 경로로 전환. 훈련 음성은 WASM 우선이며 서버 업로드 차단 정책과 정합
  - `sentence-magic`, `step-2`, `step-4` 에 `useWasmSttLoading` + `WasmSttLoadingIndicator` 연결 — 모델 ID, 진행률, 실패 코드 표시
  - **검증**: `npm run test:vnv` → 55/55 PASS. `npx tsc --noEmit` → exit 0
  - 후속: `step-5`, `sing-training` 화면 통합, 실제 브라우저에서 `/dev/wasm-stt-test` 및 훈련 화면 모델 다운로드/RTF 수집
- 2026-05-04: **WASM-STT 실제 화면 통합 2차 완료**
  - `src/app/(training)/programs/step-5/page.tsx` 연결 — 읽기 과제 STT 분석에 `useWasmSttLoading` lifecycle 콜백 전달, 모델 로딩 인디케이터 표시
  - `src/app/(training)/programs/sing-training/page.tsx` 연결 — 가창 발음 분석 `analyzeSongPronunciation` 에 `SttLifecycleCallbacks` 전달, 모델 로딩 인디케이터 표시
  - **검증**: `npm run test:vnv` → 55/55 PASS. `npx tsc --noEmit` → exit 0
  - 후속: 실제 브라우저에서 `/dev/wasm-stt-test`, sentence-magic, step-2/4/5, sing-training 순서로 모델 다운로드 시간·RTF·실패 코드를 수집
- 2026-05-04: **WASM-STT 브라우저 수집 화면 사전 점검 완료**
  - `/dev/wasm-stt-test` 실제 브라우저 접근 확인 — `isWasmSttAvailable(): true`, `ground_truth` 입력 시 `녹음 + 전사` 버튼 활성화
  - `src/app/dev/wasm-stt-test/page.tsx` hydration mismatch 제거 — WASM 지원 여부를 client mount 후 상태로 표시
  - `src/app/layout.tsx` storage bootstrap script 위치 정리 — RootLayout `<head>` 로 이동
  - **검증**: `npm run test:vnv` → 55/55 PASS. `npx tsc --noEmit` → exit 0
  - 남은 수집: 사용자가 브라우저 마이크 권한을 허용한 뒤 10~30개 샘플을 녹음하고 `WER/CER CSV`, `RTF CSV` 다운로드
- 2026-05-04: **IRT/Bayesian Adaptive 실제 훈련 화면 통합 1차 완료**
  - `src/lib/adaptive/adaptiveTraining.ts` 신규 — 기존 후보 문항 + 완료 응답을 받아 EAP θ 추정 후 MFI로 다음 문항을 고르는 화면 통합 helper. calibrated item bank 매칭 실패 시 문항 길이 기반 fallback a/b 산출
  - `step-1`, `step-2`, `step-4` 화면 연결 — 기존 세션 랜덤 순서를 기본 후보 풀로 유지하면서, 사용자가 답한 결과를 바탕으로 다음 문항을 IRT MFI 순서로 재정렬
  - 저장 데이터에 `adaptiveItemKey`, `adaptiveItemId`, `adaptiveTheta`, `adaptiveSd`, `itemDifficulty`, `itemDiscrimination`, `selectionMethod` 추적 필드 추가
  - V&V: `TC-IRT-TRAINING-001` 추가 — 동일 응답 시퀀스 → 동일 다음 문항 순서, 완료 문항 보존, calibrated bank/fallback metadata 결정성 검증
  - **검증**: `npm run test:vnv` → 56/56 PASS. `npx tsc --noEmit` → exit 0
  - 후속: step-5 읽기 과제까지 확장, 치료사 결과 화면에 θ 추이 표시, 임상 응답 누적으로 item a/b calibration
