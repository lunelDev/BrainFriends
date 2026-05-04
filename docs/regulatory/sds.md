# 소프트웨어 설계 명세서 (SDS) v0.1

작성일: 2026-04-30
근거: IEC 62304:2006 + AMD1:2015 §5.4 / 식약처 GMP [별첨3] 양식
관련: `srs.md` v0.1, `runDeterministicChecks.ts` 49 TC

## 1. 시스템 아키텍처 개요

```
┌─────────────────────────────────────────────────┐
│  Browser (Next.js Client)                        │
│  ├── React 19 UI                                  │
│  ├── MediaPipe (안면·시선 WASM)                    │
│  ├── transformers.js (WASM Whisper-tiny)         │
│  └── IndexedDB (모델 캐싱)                         │
└──────────────┬──────────────────────────────────┘
               │ HTTPS
┌──────────────▼──────────────────────────────────┐
│  Next.js Server (App Router 라우트 핸들러)         │
│  ├── 인증·세션 (proxy.ts 보호 라우팅)              │
│  ├── 입력 검증 (zod 9 라우트)                       │
│  ├── audit log HMAC 체인                          │
│  ├── rate limit sliding window                    │
│  ├── 결정성 lib/* (V&V 49 TC)                      │
│  └── DB 추상화 (lib/server/postgres.ts)           │
└──────────────┬──────────────────────────────────┘
               │ TLS / 자격증명
┌──────────────▼──────────────────────────────────┐
│  외부 시스템                                       │
│  ├── PostgreSQL (영속 저장)                        │
│  ├── NCP Object Storage (S3 호환, 미디어)          │
│  ├── OpenAI Whisper (서버 STT — evaluation 만)    │
│  ├── voice-analysis-service (Parselmouth)        │
│  └── (예정) SES/SMTP / KAERS                      │
└─────────────────────────────────────────────────┘
```

## 2. 모듈 구성

### 2.1 lib/vnv (V&V)

| 모듈 | 책임 |
| --- | --- |
| `requirements.ts` | SR-* 31건 정의 |
| `traceability.ts` | SR ↔ 코드 ↔ TC 47행 |
| `runDeterministicChecks.ts` | 49 TC 실행 (npm run test:vnv) |
| `iec62304Export.ts` | 별지 제2호 양식 export (JSON/MD/CSV) |
| `executionLogs.ts` | V&V 실행 결과 로그 저장 |

### 2.2 lib/speech (STT)

| 모듈 | 책임 |
| --- | --- |
| `sttPolicy.ts` | useCase × wasmAvailable × fallback → engine 결정 |
| `sttRuntime.ts` | 런타임 상태 통합 |
| `sttClientPreflight.ts` | 클라이언트 측 사전 차단 |
| `sttReview.ts` | reviewRequired 표준 상태 |
| `sttPrompt.ts` | 도메인 어휘 prompt builder |
| `wasmSttAdapter.ts` | transformers.js Whisper-tiny 실제 호출 |
| `wasmSttLoadingState.ts` | 로드 상태 머신 |
| `SpeechAnalyzer.ts` | 클라이언트 통합 |

### 2.3 lib/ai (AI 평가)

| 모듈 | 책임 |
| --- | --- |
| `werCalculator.ts` | WER/CER Levenshtein 결정성 |
| `werRunner.ts` | CSV → stratified WER 보고서 |
| `sttBenchmark.ts` | RTF/P95 latency 결정성 |
| `evaluationDataset.ts` | 평가 샘플 자격 판정 |
| `measurementCollector.ts` | 측정 데이터 수집 |
| `modelGovernance.ts` | 모델 버전 추적 |
| `performanceMetrics.ts` | 성능 지표 산출 |

### 2.4 lib/server (보안·infra)

| 모듈 | 책임 |
| --- | --- |
| `accountAuth.ts` | 비밀번호 강도 |
| `loginLockout.ts` | 5회 실패 → 15분 잠금 |
| `sessionLockout.ts` | 30분 idle |
| `rateLimit.ts` | sliding window |
| `auditChain.ts` | HMAC 체인 + append-only |
| `errorCodes.ts` | 통합 오류 dictionary |
| `inputSchemas.ts` | zod 8 스키마 |
| `phiMasking.ts` | PHI 결정성 마스킹 |
| `riskClassification.ts` | ISO 14971 분류 |
| `changeImpactAnalysis.ts` | 변경 영향평가 |
| `releaseManifest.ts` + `releaseManifestStartup.ts` | 형상관리 |
| `soupRegistry.ts` | SOUP 정규화 |
| `ncpObjectStorage.ts` | S3 presigned URL |
| `postgres.ts` | DB 추상화 |
| `auditLog.ts` | 감사 기록 |

### 2.5 lib/* (도메인)

| 모듈 | 책임 |
| --- | --- |
| `lib/aac/intentTemplate.ts` | AAC 심볼 → 의도 문장 |
| `lib/aac/trainingIntegration.ts` | step 통합 |
| `lib/adaptive/irt.ts` | 2PL IRT + MFI |
| `lib/guardian/weeklyReportSummary.ts` | 보호자 리포트 |
| `lib/guardian/consentState.ts` | 동의 상태머신 |
| `lib/guardian/reportLinkPolicy.ts` | 링크 만료/폐기 |
| `lib/kwab/KWABScoring.ts` | K-WAB 자동 채점 |
| `lib/kwab/SessionManager.ts` | 세션 관리 |
| `lib/training/gazeAccumulator.ts` | 시선 누적 |
| `lib/usability/useScenarioValidator.ts` | IEC 62366 합격기준 |
| `lib/security/patientReportAccess.ts` | 환자 리포트 접근통제 |
| `lib/adverse-events/adverseEventReview.ts` | 이상반응 검토 |
| `lib/analysis/versioning.ts` | AI/STT 버전 메타 |

## 3. 주요 데이터 모델

### 3.1 환자 세션

- session_id (UUID), patient_pseudonym_id, completed_at, aq, step_scores, step_details, history_id

### 3.2 K-WAB 결과

- spontaneousSpeech / auditoryComprehension / repetition / naming / reading / writing 6 하위검사
- AQ / LQ / CQ 자동 산출
- measurementQuality (measured / partial / demo)

### 3.3 이상반응

- adverse_event_id, patient_id, category (headache/fatigue/dizziness/voice_fatigue/eye_fatigue/anxiety/other), severity (1/2/3), free_text, reported_at

### 3.4 release manifest

- git_sha, package_lock_sha256, python_requirements_sha256, sbom_sha256, soup_sha256, model_assets[] (id + sha256)
- manifestHash (모든 위 sha256 조합)

## 4. 인터페이스 설계

### 4.1 API 라우트 분류

| 카테고리 | 라우트 | 보호 |
| --- | --- | --- |
| auth | login / signup / reset-password / find-login-id / dev-login | proxy.ts public |
| patient | link-care / care | session 필수 |
| therapist | reports / patients/* / system/* | therapist 권한 |
| training | aac/intent / proxy/stt | session 필수 |
| guardian | report-link / cron/weekly-report | token 또는 admin |
| security | security-audit | admin 만 |
| AI eval | (CLI 만, API 없음) | — |

### 4.2 보호 라우팅

`src/proxy.ts` 가 미들웨어로 모든 라우트 가드. 자세한 정책은 본 파일 참조.

## 5. 결정성 보장 설계

본 SDS 의 모든 lib/* 모듈은 다음 원칙을 따른다:

1. 동일 입력 → 동일 출력 (no Date.now() / Math.random() 의존)
2. 외부 sort 키는 알파벳 정렬 (locale-independent)
3. JSON 직렬화 시 sortKeys 적용
4. 부동소수점 결과는 round4 (1e-4 정밀도) 또는 round6 (1e-6) 적용
5. 모듈 top-level 부작용 없음 (lazy import / lazy init 만 허용)

이 원칙이 49 TC 의 결정성 검증 (`assert.deepEqual(repeat, original)`) 을 가능하게 한다.

## 6. 갱신 이력

- 2026-04-30 v0.1: 초안. 모듈 38종 분류 + 데이터 모델 4 + API 라우트 7 카테고리 + 결정성 5 원칙.
