# 소프트웨어 요구사항 명세서 (SRS) v0.1

작성일: 2026-04-30
근거: IEC 62304:2006 + AMD1:2015 §5.2 / 식약처 디지털의료기기 GMP [별표3] 1.1.2 / [별첨2] 양식
관련: `requirements.ts` (SR-* 31개), `traceability.ts` (47행)

## 1. 문서 목적과 범위

본 SRS 는 브레인프렌즈 SaMD 의 소프트웨어 요구사항을 IEC 62304 §5.2 양식으로 정리한다. 모든 요구사항은 코드 (src/lib/vnv/requirements.ts) 와 1:1 추적된다.

## 2. 시스템 개요

- 제품명: 브레인프렌즈
- 버전: v0.1 (개발 중, 시판 전)
- 분류: 독립형 디지털의료기기소프트웨어 (SaMD)
- 예비 SW 안전성 등급: Class B (RM-* §3 권고)
- 사용 환경: 웹 기반 (Next.js App Router 16, React 19, Node.js 22)
- 사용자: 환자 (U1) / 치료사·의사 (U2) / 보호자 (U3)

## 3. 기능 요구사항 (IEC 62304 §5.2.2)

### 3.1 인증·세션·권한 (SR-LOGIN, SR-PERMISSION, SR-SESSION)

| ID | 요구사항 |
| --- | --- |
| SR-LOGIN-001 | 유효한 계정으로 로그인 → 환자 세션 생성 → 다음 화면 routing |
| SR-PERMISSION-002 | 카메라·마이크 권한 거부 → 훈련 흐름 진입 차단. 환자 리포트 접근은 admin 또는 담당 치료사로 제한 |
| SR-SESSION-003 | 각 step 결과 저장 + 동일 사용자 흐름에서 복원 가능 |

### 3.2 점수·이력 (SR-SCORE, SR-HISTORY, SR-MEASURE)

| ID | 요구사항 |
| --- | --- |
| SR-SCORE-004 | step 결과 → AQ 점수 자동 계산 (KWABScoring) |
| SR-HISTORY-005 | 세션 종료 → history entry 생성 + 결과 재조회. 저장 실패 시 compact/server-only fallback + 재시도 |
| SR-MEASURE-006 | 측정 상태 measured / partial / demo 정확 분류 |

### 3.3 멀티모달 입력 (SR-GAZE, SR-AAC, SR-STT)

| ID | 요구사항 |
| --- | --- |
| SR-GAZE-007 | MediaPipe iris 랜드마크 → 동일 입력 동일 gazeX/gazeY/centeredScore. history summary 보존 |
| SR-AAC-008 | AAC 심볼 시퀀스 → 결정성 한국어 의도 문장 생성. inputModality=aac 추적 |
| SR-STT-009 | useCase 별 STT 정책 (mock / WASM / server / disabled) 결정성 분리. WASM 미가용 + fallback false → 차단 |

### 3.4 리포트·이상반응 (SR-GUARDIAN, SR-AE)

| ID | 요구사항 |
| --- | --- |
| SR-GUARDIAN-010 | 보호자 read-only 주간 리포트 결정성 요약 (최근 7일) |
| SR-AE-011 | 이상반응 신고 최신순 조회 + 미해결/미확인 중증 분류 |

### 3.5 위험관리·규제 (SR-RISK, SR-PHI, SR-AI-EVAL, SR-CONSENT, SR-CHANGE, SR-IEC62304-EXPORT, SR-USABILITY, SR-IRT)

| ID | 요구사항 |
| --- | --- |
| SR-RISK-012 | ISO 14971 위해요인 severity × probability → riskClass A/B/C 결정성 분류 |
| SR-PHI-013 | PHI 마스킹 결정성 (이름/전화/RRN/이메일/환자ID) |
| SR-AI-EVAL-014 | WER/CER Levenshtein 결정성 + NFC 정규화 + passRateAt15 |
| SR-CONSENT-015 | 보호자 동의 상태머신 결정성 (pending/granted/revoked/expired, TTL 7일) |
| SR-CHANGE-016 | 변경관리 영향평가 (release manifest delta → 영향받는 SR-* + major/minor/patch) |
| SR-IEC62304-EXPORT | IEC 62304 별지 제2호 추적성 매트릭스 export (JSON/MD/CSV) 결정성 |
| SR-USABILITY-017 | IEC 62366 사용성평가 합격기준 결정성 산출 (critical=100% / primary=80% / severe unmitigated=0) |
| SR-IRT-018 | 2PL IRT + MFI 적응형 알고리즘 결정성 |
| SR-AI-EVAL-RUNNER | WER/CER runner CLI 결정성 (stratified by ageGroup/severity/noise/device) |
| SR-AI-RTF-RUNNER | RTF/P95 latency runner CLI 결정성 |
| SR-WASM-STT-LOADING | WASM Whisper 로드 상태 머신 결정성 |

### 3.6 사이버보안 (SR-SEC-IA05/IA07/UC03/RA01/UC07/TRE01/SI07/SI05/SI04-SOUP/SI04-MANIFEST)

식약처 사이버보안 가이드라인 35 항목 중 10 항목 결정성 V&V 통제. 자세한 매핑은 `docs/security/cybersecurity-final-readiness-report.md` 참조.

## 4. 비기능 요구사항

| 영역 | 목표 |
| --- | --- |
| AI STT WER (한국어 60~80대) | meanWer ≤ 0.15 (claim-lock §4 → §3 승격 조건) |
| AI STT P95 latency | ≤ 41.5ms (제품기획서 클레임) |
| 사용성 critical task 통과율 | 100% |
| 사용성 primary task 통과율 | ≥ 80% |
| 사이버보안 가이드라인 일치도 | ≥ 80% (현재 ~77%) |
| V&V 결정성 회귀 | 0건 (모든 PR) |
| TLS | NCP/AWS Object Storage / API 모두 https |

## 5. 제약사항

- 브라우저 환경: Chromium 110+, Safari 16+, Firefox 110+ (WASM + AudioContext 필요)
- Node.js: ≥ 20.6 (tsx 실행)
- DB: PostgreSQL ≥ 14
- 모델 자산: face_landmarker.task (`docs/security/manifest/latest.json` sha256 동결), Xenova/whisper-tiny (IndexedDB 캐싱)

## 6. 인터페이스

### 6.1 외부 시스템

- NCP Object Storage (S3 호환): 미디어 업로드 / presigned URL
- HuggingFace CDN: WASM Whisper 모델 다운로드 (1회만)
- (예정) SES / SMTP: 보호자 주간 리포트 발송
- (예정) KAERS: 의료기기 사고 보고

### 6.2 내부 컴포넌트

- App Router (Next.js): 라우팅
- React 19 / Tailwind: UI
- PostgreSQL: 영속 저장
- localStorage / sessionStorage: 클라이언트 상태
- IndexedDB: WASM 모델 캐싱

## 7. 추적성

본 SRS 의 모든 SR-* 는 `src/lib/vnv/requirements.ts` 의 `SOFTWARE_REQUIREMENTS` 배열과 일치한다. IEC 62304 별지 제2호 양식의 추적성 매트릭스 (요구사항 ↔ 설계 ↔ 구현 ↔ 시험 ↔ 위해) 는 `/api/therapist/system/iec62304-traceability?format=md` 로 자동 생성된다.

## 8. 갱신 이력

- 2026-04-30 v0.1: 초안. SR-* 31건 + 비기능 요구사항 7 + 제약사항 4 + 인터페이스 + 추적성.
