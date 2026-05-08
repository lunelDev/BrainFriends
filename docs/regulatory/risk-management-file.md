# 브레인프렌즈 위험관리 파일 v0.1

작성일: 2026-04-29  
기준 문서: `claim-lock.md`, `intended-use-and-contraindications.md`, `digital-medical-product-gap-matrix.md`  
적용 범위: 1차 허가 범위의 독립형 디지털의료기기소프트웨어(SaMD)

## 1. 목적

이 문서는 브레인프렌즈의 1차 허가 범위에서 예상 가능한 위해요인을 식별하고, 위험통제와 검증 근거를 연결하기 위한 ISO 14971 형식의 내부 위험관리 파일 초안이다.

본 문서는 최종 위험관리 보고서가 아니다. 품목분류, 식약처 사전상담, 임상시험계획, 실제 사용성평가, 보안시험, V&V 결과에 따라 갱신한다.

## 2. 제품 범위

### 2.1 1차 사용목적

브레인프렌즈는 뇌졸중, 외상성 뇌손상, 기타 뇌질환 이후 발생한 실어증 또는 마비말장애 환자를 대상으로, 의료진의 관리하에 언어재활 훈련 수행과 경과 모니터링을 보조하기 위해 사용하는 독립형 디지털의료기기소프트웨어이다.

### 2.2 제품 경계

| 포함 | 제외 |
| --- | --- |
| 언어재활 훈련 보조 | 자동 진단 |
| 음성·안면·반응시간·시선·AAC 기반 보조 지표 | 자동 처방 |
| K-WAB 기반 보조 채점 | 의료진 대체 의사결정 |
| 치료사 대시보드와 보호자 read-only 리포트 | 응급·급성기 판단 |
| 이상반응 보고와 감사로그 | MCI·치매 예방·일반 인지개선 치료효과 |

## 3. 예비 SW 안전성 등급 판단

현재 제품은 치료사·의사 검토를 전제로 하는 재활 보조 SaMD이며, 제품 출력이 직접 생명유지 또는 응급 처치를 제어하지 않는다.

예비 판단은 다음과 같다.

| 항목 | 판단 |
| --- | --- |
| 직접 치료 제어 | 없음 |
| 직접 약물·기기 제어 | 없음 |
| 단독 진단 또는 처방 결정 | 금지 클레임으로 제외 |
| 잘못된 출력의 잠재 위해 | 부적절한 재활 방향, 치료 지연, 개인정보 침해, 환자 불편 |
| 예비 SW 안전성 등급 | Class B 수준으로 준비 권고 |

최종 등급은 위해 심각도, 의료진 개입 정도, 허가 범위, 식약처 의견에 따라 확정한다.

## 4. 위험 평가 기준

### 4.1 심각도

| 등급 | 의미 | 예시 |
| --- | --- | --- |
| S1 | 경미 | 일시적 불편, 재측정 필요 |
| S2 | 중등도 | 훈련 지연, 잘못된 경과 해석, 추가 의료진 확인 필요 |
| S3 | 중대 | 부적절한 치료 방향 지속, 민감정보 노출, 임상 판단 지연 |
| S4 | 치명 | 생명 위협 또는 영구 손상. 현재 제품 범위에서는 직접 위해 가능성 낮음 |

### 4.2 발생 가능성

| 등급 | 의미 |
| --- | --- |
| P1 | 매우 낮음 |
| P2 | 낮음 |
| P3 | 가능 |
| P4 | 높음 |
| P5 | 매우 높음 |

### 4.3 위험 수용 기준

| 잔여위험 | 기준 |
| --- | --- |
| 수용 가능 | 의료진 검토, 사용자 안내, 기술적 통제로 위험이 낮아진 상태 |
| 조건부 수용 | 추가 V&V, 사용성평가, 보안시험 또는 임상 확인 필요 |
| 수용 불가 | 허가 범위 또는 제품 기능에서 제거하거나 설계 변경 필요 |

## 5. 위험관리 매트릭스

| ID | 위해요인 | 예측 가능한 사건 순서 | 가능한 위해 | 초기 위험 | 위험통제 | 잔여위험 | 검증/근거 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RM-001 | STT 전사 오류 | 발음장애·소음·마이크 품질 저하 → STT 오인식 → 수행 점수 또는 치료사 판단에 영향 | 잘못된 경과 해석, 부적절한 훈련 방향 | S3/P3 | STT 결과를 보조 전사로 제한, 치료사 검토 문구, useCase별 STT 정책 (training/evaluation=server Whisper via secure proxy, WASM=experiment only), 도메인 prompt, 목표 phrase 기반 유사도 판정, 오류 가능성 고지, 실패·빈 전사 시 `reviewRequired=true` | 조건부 수용 | `SR-STT-009`, `sttPolicy.ts`, `sttPrompt.ts`, `sttReview.ts`, `SpeechAnalyzer.ts`, `api/proxy/stt/route.ts`, `TC-RISK-001`, `TC-STT-001/002/003`, AI 평가 문서 |
| RM-002 | 서버 STT 데이터 전송 경계 오해 | 제품 전체를 온디바이스로 설명 → 실제 STT 전송 발생 → 개인정보·보안 심사 불일치 | 민감정보 처리 고지 미흡, 심사 보완 | S2/P2 | 클레임 잠금표에서 "완전 온디바이스 STT" 및 "원본 음성 미전송" 금지, 브라우저 직접 외부 전송 없음/서버 보안 프록시/원본 음성 비영구 저장 경계 문서화, WASM-STT는 실험 후보로만 표시 | 조건부 수용 | `claim-lock.md`, `cloud-and-data-transfer.md`, `sttPolicy.ts`, `api/proxy/stt/route.ts`, `TC-STT-001/002/003` |
| RM-003 | 안면 랜드마크 측정 실패 | 조도·각도·얼굴 가림 → 입술/구강 지표 오류 → 조음 상태 오해 | 잘못된 보조 지표 제공 | S2/P3 | 측정 품질 표시, no-face/init-error fallback, 치료사 검토, 재측정 안내 | 수용 가능 | `FaceTracker.tsx`, `faceAnalysis.ts`, `SR-MEASURE-006` |
| RM-004 | 시선 측정 실패 또는 오해 | 홍채 미검출·안경·조도 문제 → off-task 지표 왜곡 → 주의집중 저하로 오해 | 잘못된 참여도 해석 | S2/P3 | irisDetected, measurementQuality, attentionRatio를 보조 지표로 제한, 인지기능 진단 금지 | 수용 가능 | `SR-GAZE-007`, `gazeAccumulator.ts`, `TC-GAZE-*` |
| RM-005 | K-WAB 보조 점수의 진단 오해 | 자동 계산값 제공 → 사용자 또는 보호자가 확정 진단으로 해석 | 의료진 평가 지연, 불안 유발 | S3/P2 | 자동 진단 금지 클레임, 치료사 검토·확정 워크플로우, 결과 화면 문구 | 조건부 수용 | `SR-SCORE-004`, `KWABScoring.ts`, 사용성평가 필요 |
| RM-006 | AAC 문장 생성 오해 | 사용자가 심볼 선택 → 규칙형 문장 생성 → AI 의도 예측으로 오해 | 환자 의도 왜곡, 보호자·치료사 오해 | S2/P3 | AAC Phase 1을 사용자 선택 기반 규칙형 변환으로 명시, unknownIds 누적, sequence preview | 수용 가능 | `SR-AAC-008`, `intentTemplate.ts`, `AACBoard.tsx` |
| RM-007 | 부적절한 대상자 사용 | MCI·응급·급성기·과제 수행 불가 환자가 사용 → 결과 신뢰성 저하 | 평가 지연, 부적절한 재활 | S3/P2 | 사용목적 잠금, 포함/제외 기준, 최초 사용 전 의료진 확인 | 조건부 수용 | `intended-use-and-contraindications.md`, 온보딩 체크 필요 |
| RM-008 | 환자 피로·불편 누락 | 반복 훈련 중 피로·불안·통증 발생 → 계속 사용 | 불편 악화, 중도탈락, 이상반응 | S2/P3 | 이상반응 보고, 사용 중단 안내, 치료사 follow-up, 보호자 리포트에 이상반응 요약, 미확인 중증 건 검토 필요 분류 | 조건부 수용 | `adverse_events.sql`, adverse-events API, `adverseEventReview.ts`, `SR-AE-011`, `TC-RISK-003` |
| RM-009 | 보호자 링크 오남용 | 링크 유출 또는 장기 노출 → 제3자 접근 | 민감 건강정보 노출 | S3/P3 | read-only 제한, 토큰 기반 접근, 만료 차단, 수동 폐기, 생성·접근·폐기 감사로그, 치료사 환자 권한 확인 | 조건부 수용 | `guardianReportsDb.ts`, `report-link/route.ts`, `reportLinkPolicy.ts`, `TC-RISK-002` |
| RM-010 | 권한 없는 치료사 접근 | 인증/권한 검증 미흡 → 다른 환자 정보 조회 | 개인정보·의료정보 노출 | S3/P2 | 세션 기반 접근통제, admin/담당 치료사만 환자 리포트 접근 허용, 비담당 치료사·타 환자·비허용 역할 차단, 감사로그, 보안 테스트 | 조건부 수용 | `SR-LOGIN-001`, `SR-PERMISSION-002`, `patientReportAccess.ts`, `TC-RISK-004`, security 문서 |
| RM-011 | 결과 저장 실패 | 네트워크·DB 오류 → 세션 결과 미저장 또는 부분 저장 | 경과 추적 누락, 치료사 판단 자료 부족 | S2/P3 | 저장/복원 요구사항, compact/server-only fallback, 서버 재시도, 재시도 소진 시 수동 검토, 서버 결과 우선 재조회 | 조건부 수용 | `SR-SESSION-003`, `SR-HISTORY-005`, `deterministicChecks.ts`, `TC-RISK-005` |
| RM-012 | 반응시간 왜곡 | 기기 성능·브라우저·네트워크 영향 → reactionTime 부정확 | 참여도 또는 수행능력 오해 | S2/P2 | 보조 지표로 제한, 기기/환경 영향 문서화, 동일 환경 비교 권장 | 수용 가능 | SessionManager, step pages |
| RM-013 | AI 보조 지표의 과신 | 대시보드 수치와 그래프를 의료진이 과신 → 임상 맥락 누락 | 부적절한 훈련 조정 | S3/P2 | AI 역할 경계 문서, 치료사 검토 문구, explainability/품질 지표 표시, 모듈별 금지 사용 정의 | 조건부 수용 | `claim-lock.md`, `ai-role-boundary.md` |
| RM-014 | 성능 수치 미검증 클레임 | WER 15%, P95 지연 등 미검증 수치 사용 → 심사 보완 또는 신뢰성 저하 | 허가 지연, 문서 불일치 | S2/P3 | 클레임 잠금표, 검증셋 완료 전 목표치로만 표기, 성능시험 계획 | 조건부 수용 | `claim-lock.md`, AI 평가 데이터셋 문서 |
| RM-015 | 사이버보안 취약점 | 웹/API 취약점, 의존성 취약점, 부적절한 저장 → 정보 노출/변조 | 민감정보 침해, 결과 무결성 손상 | S3/P3 | 인증/권한, 감사로그, 민감정보 분류, 보안 문서, 취약점 점검, SBOM 필요 | 조건부 수용 | `docs/remediation/02-cybersecurity/*`, `docs/security/README.md` |
| RM-016 | 감사로그 부족 | 주요 접근·변경 기록 누락 → 사고 추적 불가 | 보안 사고 대응 지연, 규제 증적 부족 | S2/P3 | auditLog 사용, 감사로그 스키마, 보호자 링크/평가/권한 변경 기록 확대 | 조건부 수용 | `docs/10-operations/audit-log-schema.md`, `auditLog.ts` |
| RM-017 | 개인정보/PHI 혼재 | 식별정보와 건강정보가 과도하게 결합 저장 → 접근 범위 확대 | 개인정보 침해 영향 증가 | S3/P2 | PII/PHI 분리 정책, 최소 수집, 접근권한 분리, 보존기간 정책 | 조건부 수용 | `docs/10-operations/pii-phi-separation.md` |
| RM-018 | 부정확한 보호자 해석 | 보호자가 리포트를 치료효과 또는 처방 변경 근거로 해석 | 치료계획 혼선, 불필요한 불안 | S2/P3 | read-only, 의료진 문의 안내, 치료 판단 권한 없음 명시, 요약 문구 제한 | 수용 가능 | guardian report summary, `claim-lock.md` |
| RM-019 | 변경관리 부재 | STT 모델, prompt, scoring 로직 변경 → 기존 성능 근거와 불일치 | 성능 재현성 저하, 심사 증적 부족 | S3/P3 | 버전 기록, STT 엔진/useCase/정책 사유/prompt 버전·hash/원본 음성 외부 전송 여부 기록, 변경 영향평가, 재검증 트리거, traceability matrix 작성 | 조건부 수용 | `versioning.ts`, `sttPrompt.ts`, `TC-RISK-006`, submission version guide, traceability 작성 필요 |
| RM-020 | 훈련 난이도 부적절 | 휴리스틱 난이도 조정이 환자 상태와 불일치 → 과도한 난이도 또는 낮은 난이도 | 피로, 좌절, 훈련 효과 저하 | S2/P3 | 치료사 처방 우선, 난이도 수동 조정, IRT 구현 전 클레임 하향 | 조건부 수용 | `articulationConfig.ts`, IRT 구현 또는 클레임 제한 |
| RM-021 | 서비스 거부 (DoS) | 외부 트래픽 burst → 정상 사용자 차단 → 처방 만료 전 훈련 횟수 미달 | 진료 차단, follow-up 일정 영향 | S2/P3 | 라우트별 sliding window rate limit (login/AAC/STT/리포트), retryAfterMs 응답, 감사로그 기록 | 수용 가능 | `SR-SEC-RA01`, `rateLimit.ts`, `TC-SEC-RA01-001` |

## 6. 위험통제 요구사항 연결

| 위험통제 | 연결 요구사항/문서 | 상태 |
| --- | --- | --- |
| 로그인과 세션 관리 | `SR-LOGIN-001`, `SR-SESSION-003` | 부분 구현 |
| 카메라·마이크 권한 차단 | `SR-PERMISSION-002` | 부분 구현 |
| 점수 결정성 | `SR-SCORE-004`, `SR-MEASURE-006` | V&V 있음 |
| 결과 저장·재조회 | `SR-HISTORY-005` | 부분 구현 |
| 시선 결정성 | `SR-GAZE-007` | V&V 있음 |
| AAC 문장 결정성 | `SR-AAC-008` | V&V 있음 |
| STT useCase 정책 | `SR-STT-009` | V&V 있음 |
| 보호자 리포트 요약 | `SR-GUARDIAN-010` | V&V 있음 |
| 이상반응 보고 | `docs/database/adverse_events.sql`, adverse-events API, `SR-AE-011` | V&V 있음 |
| 감사로그 | `docs/10-operations/audit-log-schema.md`, `auditLog.ts` | 확대 필요 |
| 개인정보/PHI 분리 | `docs/10-operations/pii-phi-separation.md` | 정책 문서 있음 |
| 사이버보안 | `docs/remediation/02-cybersecurity/*` | 시험 증적 보강 필요 |
| AI 성능평가 | `docs/remediation/03-ai-evaluation/*` | 실제 검증셋 필요 |

## 7. 잔여위험 평가

현재 v0.1 기준 잔여위험은 대부분 조건부 수용 상태다. 이유는 코드 기반 통제는 상당 부분 존재하지만, 허가 제출용 증적이 아직 부족하기 때문이다.

| 잔여위험 묶음 | 현재 판단 | 필요한 추가 조치 |
| --- | --- | --- |
| STT/AI 성능 | 조건부 수용 | 검증셋, WER/CER, 오류 케이스 로그, 모델·prompt 버전 기록 |
| K-WAB/점수 해석 | 조건부 수용 | 치료사 검토 UI 명시, 결과지 문구, 사용성평가 |
| 개인정보/보안 | 조건부 수용 | 보호자 링크 만료, SBOM, 취약점 점검, 접근권한 테스트 |
| 사용대상 적합성 | 조건부 수용 | 온보딩 exclusion 체크, 의료진 확인 로그 |
| 환자 불편/이상반응 | 조건부 수용 | 훈련 중 중단 UX, 중증 이상반응 알림, 치료사/처방자 확인 UI 보강 |
| 측정 실패 | 대체로 수용 가능 | 품질 지표 표시와 재측정 안내 강화 |

## 8. 즉시 추가할 V&V 케이스

다음 테스트는 위험통제 증적을 만들기 위해 우선 추가한다.

| TC 제안 | 연결 위험 | 기대 결과 |
| --- | --- | --- |
| TC-RISK-001 STT 실패 시 review-required 상태 | RM-001 | 구현 완료. STT 실패, 빈 전사, 서버 송신 차단 시 review-required 로 분류 |
| TC-RISK-002 보호자 링크 만료/폐기 | RM-009 | 구현 완료. 만료 또는 폐기된 token 접근 차단 |
| TC-RISK-003 이상반응 신고 저장·조회 | RM-008 | 구현 완료. 최신순 조회, 미해결/미확인 중증 건 분류, 보호자 리포트 reported 상태 반영 |
| TC-RISK-004 권한 없는 환자 리포트 접근 차단 | RM-010 | 구현 완료. admin/담당 치료사 허용, 비담당 치료사·타 환자·비허용 역할 차단 |
| TC-RISK-005 history 저장 실패 fallback | RM-011 | 구현 완료. quota 초과, 브라우저 저장 불가, 서버 재시도, 재시도 소진, 서버/로컬 불일치 처리 검증 |
| TC-RISK-006 AI/STT 버전 메타데이터 기록 | RM-019 | 구현 완료. STT 엔진, useCase, 정책 사유, prompt 버전·hash, 원본 음성 외부 전송 여부, review flag 기록 검증 |

## 9. 위험관리 파일 갱신 규칙

다음 사건이 발생하면 본 문서를 갱신한다.

- 사용목적, 대상 환자, 출력 정보 변경
- STT 엔진, AI 모델, scoring 로직, prompt 변경
- 시선·안면·AAC 알고리즘 변경
- 신규 이상반응 또는 사용자 불만 발생
- 보안 취약점 또는 개인정보 사고 발생
- V&V 실패 또는 임상시험 중 protocol deviation 발생
- 식약처 사전상담 또는 시험기관 보완 의견 수령

## 10. 다음 산출물

다음 규제 문서는 `docs/regulatory/traceability-matrix.md` 로 작성한다.

목표는 다음 항목을 하나의 표로 연결하는 것이다.

- 사용목적
- 위험 ID
- 소프트웨어 요구사항 ID
- 설계/구현 파일
- V&V 테스트 케이스
- 잔여위험 상태
- 제출 증적 문서

## 11. 결정성 V&V 함수 매핑 (v0.2 — 2026-04-30 추가)

본 문서의 모든 위해요인 (RM-*) 은 다음 결정성 V&V 함수와 IEC 62304 별지 제2호 추적성 매트릭스에 자동으로 연결된다. 시판 후 변경 시 본 §11 의 매핑이 갱신 트리거로 작동한다.

### 11.1 위해요인 식별자 ↔ 사이버보안 hazardId 매핑

`src/app/api/therapist/system/iec62304-traceability/route.ts` 의 `HAZARD_LINKS` 는 사이버보안 측면에서 본 위해요인 7건을 별도 식별자 (H-*) 로 정의한다. v0.2 기준 매핑은 다음과 같다:

| RM-* (도메인) | H-* (사이버보안 측면) | 비고 |
| --- | --- | --- |
| RM-001 STT 전사 오류 | RM-001 | v0.3 에서 식별자 통일 ✅ |
| RM-009 보호자 링크 오남용 | RM-009 | v0.3 에서 식별자 통일 ✅ |
| RM-010 권한 없는 치료사 접근 | RM-010 | v0.3 에서 식별자 통일 ✅ |
| RM-016 감사로그 부족 | RM-016 | v0.3 에서 식별자 통일 ✅ |
| RM-017 개인정보/PHI 혼재 | RM-017 | v0.3 에서 식별자 통일 ✅ |
| RM-019 변경관리 부재 | RM-019 | v0.3 에서 식별자 통일 ✅ |
| RM-021 서비스 거부 (DoS) | RM-021 | v0.3 에서 신규 등재 + HAZARD_LINKS 통합 ✅ |

> **2026-04-30 v0.3**: 식별자 체계 단일화 완료. `HAZARD_LINKS` (`src/app/api/therapist/system/iec62304-traceability/route.ts`) 와 V&V fixture (TC-IEC62304-001) 도 RM-* 로 갱신. RM-021 (DoS) 신규 등재.

### 11.2 결정성 위험분류 함수 (SR-RISK-012)

`src/lib/server/riskClassification.ts` 의 `classifyHazard()` / `scoreToRiskClass()` / `summarizeHazards()` 가 §4.1~4.2 의 심각도 × 발생가능성 매트릭스를 결정성으로 산출한다.

| 점수 (S × P) | riskClass | 본 문서 §4 매핑 |
| --- | --- | --- |
| 1 ~ 6 | A | 수용 가능 (의료진 검토 + 안내 충분) |
| 7 ~ 14 | B | 조건부 수용 (위험통제 + 잔여위험 평가) |
| 15 ~ 25 | C | 수용 불가 (설계 변경 또는 클레임 제거) |

검증: TC-RISK-012-001 (`src/lib/vnv/runDeterministicChecks.ts`). 동일 (severity, probability) 입력 → 동일 riskClass + controlEffective 산출. summarizeHazards 의 unacceptable 카운트가 residualRiskClass=C 인 항목 수와 일치.

### 11.3 위해요인 → 결정성 V&V 직접 매핑

| RM-* | 통제 SR-* | 결정성 V&V TC | 결정성 함수 |
| --- | --- | --- | --- |
| RM-001 STT 전사 오류 | SR-STT-009 / SR-AI-EVAL-014 / SR-MEASURE-006 | TC-RISK-001 / TC-AI-EVAL-014-001 / TC-MQ-001 | `resolveSttPolicy` / `calculateWer` / `buildMeasurementQualitySnapshot` |
| RM-002 STT 데이터 전송 경계 | SR-STT-009 | TC-STT-001~003 | `resolveSttPolicy` / `resolveClientSttPreflight` / `resolveSttRuntime` |
| RM-005 K-WAB 진단 오해 | SR-SCORE-004 / SR-MEASURE-006 | TC-SCORE-001 / TC-MQ-001 | `calculateKWABScores` |
| RM-008 환자 피로/이상반응 | SR-AE-011 / SR-GUARDIAN-010 | TC-RISK-003 / TC-GUARDIAN-001 | `buildAdverseEventReviewSummary` / `buildWeeklyReportSummary` |
| RM-009 보호자 링크 오남용 | SR-CONSENT-015 / SR-GUARDIAN-010 | TC-RISK-002 / TC-CONSENT-015-001 | `evaluateGuardianConsent` / `isLegalTransition` |
| RM-010 권한 없는 치료사 접근 | SR-PERMISSION-002 / SR-SEC-IA05 / SR-SEC-IA07 / SR-SEC-UC03 | TC-RISK-004 / TC-SEC-IA05/07/UC03-001 | `resolvePatientReportAccess` / `validatePasswordStrength` / `evaluateLoginAttempt` / `evaluateSessionIdle` |
| RM-011 결과 저장 실패 | SR-HISTORY-005 | TC-SAVE-FAIL-001 / TC-SAVE-RETRY-001 / TC-RESULT-REFETCH-001 | `buildHistorySaveFailureOutcome` / `resolveResultRefetchMismatchOutcome` |
| RM-015 사이버보안 취약점 | SR-SEC-RA01 / SR-SEC-SI04-SOUP / SR-SEC-SI04-MANIFEST | TC-SEC-RA01-001 / TC-SEC-SI04-SOUP-001 / TC-SEC-SI04-MANIFEST-001 | `evaluateRateLimit` / `buildSoupList` / `buildManifest` / `verifyManifest` |
| RM-016 감사로그 부족 | SR-SEC-UC07 / SR-SEC-TRE01 | TC-SEC-UC07-001 / TC-SEC-TRE01-001 | `appendAuditEntry` / `verifyAuditChain` (시간 단조성 통합) |
| RM-017 개인정보/PHI 혼재 | SR-PHI-013 / SR-SEC-UC07 | TC-PHI-013-001 / TC-SEC-UC07-001 | `maskPhi` / `maskPhiObject` |
| RM-019 변경관리 부재 | SR-CHANGE-016 / SR-SEC-SI04-MANIFEST / SR-SEC-SI04-SOUP | TC-CHANGE-016-001 / TC-SEC-SI04-MANIFEST-001 / TC-SEC-SI04-SOUP-001 / TC-RISK-006 | `analyzeChangeImpact` / `verifyManifest` / `attachSpeechVersionMetadata` |
| RM-005 K-WAB 진단 오해 (사용성) | SR-USABILITY-017 | TC-USABILITY-001 | `evaluateSummativeUsability` (POF-07 critical, criticalTaskCompletionRate=1.0) |
| RM-006 AAC 문장 생성 오해 (사용성) | SR-USABILITY-017 | TC-USABILITY-001 | `evaluateSummativeUsability` (POF-04 primary 80%) |
| RM-008 환자 피로/이상반응 (사용성) | SR-USABILITY-017 / SR-AE-011 | TC-USABILITY-001 / TC-RISK-003 | `evaluateSummativeUsability` (POF-05 critical, POF-06 primary) / `buildAdverseEventReviewSummary` |
| RM-013 AI 보조 지표 과신 (사용성) | SR-USABILITY-017 | TC-USABILITY-001 | `evaluateSummativeUsability` (POF-07 critical + POF-12 primary, severe unmitigated=0) |
| RM-018 부정확한 보호자 해석 (사용성) | SR-USABILITY-017 / SR-GUARDIAN-010 | TC-USABILITY-001 / TC-GUARDIAN-001 | `evaluateSummativeUsability` (POF-12 primary 80%) / `buildWeeklyReportSummary` |

### 11.4 IEC 62304 별지 제2호 추적성 매트릭스 export

`/api/therapist/system/iec62304-traceability?format=md` (또는 `csv` / `json`) 으로 본 위험관리 파일과 동기화된 추적성 매트릭스 (요구사항 ↔ 설계 ↔ 구현 ↔ 시험 ↔ 위해 통제) 를 출력한다.

- 결정성 함수: `buildIec62304TraceabilityMatrix()` (`src/lib/vnv/iec62304Export.ts`)
- 검증: TC-IEC62304-001 (9 assertion: requirementId 알파벳 정렬, designModules/testCaseIds 정렬, uncovered + untested 카운트, Markdown 직렬화 결정성, CSV escape 결정성)
- 출력 양식: 식약처 디지털의료기기 GMP [별표3] 1.1.1 / IEC 62304 §5.7 / PDF #5 [별첨2~5] 추적성 양식

### 11.5 변경관리 영향평가 (CIA) 자동화

`analyzeChangeImpact()` (`src/lib/server/changeImpactAnalysis.ts`, SR-CHANGE-016) 가 release manifest 두 버전을 비교해 본 §10 의 갱신 규칙 트리거를 결정성으로 산출한다.

| 변경 종류 | kind | 본 문서 § | requiresRegulatoryFiling |
| --- | --- | --- | --- |
| 모델 자산 (face_landmarker, Whisper) 추가/변경 | major | §10 "AI 모델, scoring 로직 변경" | **true** |
| package-lock 또는 SBOM 변경 | minor | §10 "STT 엔진/scoring 로직" 부분 | false (GMP 기록만) |
| git-sha 만 변경 | patch | §10 미해당 (코드 단순 수정) | false |
| ≥ 3 component 동시 변경 | major | §10 "STT/AI/UI 통신 변경" | **true** |

검증: TC-CHANGE-016-001. release manifest sha256 비교로 결정성 산출.

### 11.6 식별자 체계 정리 (v0.3 — 완료)

- ✅ RM-* (이 문서) 와 `HAZARD_LINKS` (`src/app/api/therapist/system/iec62304-traceability/route.ts`) 의 hazardId 가 단일화됨 (v0.3, 2026-04-30).
- ✅ RM-021 (DoS, 서비스 거부) 신규 등재 — §5 매트릭스에 추가, `SR-SEC-RA01` 통제, `TC-SEC-RA01-001` 검증.
- ✅ V&V fixture (TC-IEC62304-001) 도 RM-* 로 갱신.
- v1.0 은 임상/사용성 평가 결과 반영 후 확정한다 (잔여 항목: 임상 데이터 기반 P 값 재산정, IEC 62366 사용성 결과 반영, MCI 적응증 분리 결정).

## 11.7 IEC 62366 사용성평가 통제 매핑 (v0.4 — 2026-04-30 추가)

본 위험관리 파일의 사용자 이해/조작 관련 위해요인 (RM-005 / RM-006 / RM-008 / RM-013 / RM-018) 은 IEC 62366-1 사용성평가 프로토콜 v0.1 의 critical task / primary operating function / hazard related use scenario 와 직접 매핑된다.

| RM-* | IEC 62366 POF | Critical | 합격기준 (DEFAULT_SUMMATIVE_CRITERIA) |
| --- | --- | --- | --- |
| RM-005 K-WAB 진단 오해 | POF-07 (치료사 K-WAB 검토 확정) | ✅ critical | criticalTaskCompletionRate=1.0 |
| RM-006 AAC 문장 생성 오해 | POF-04 (AAC 보드 commit) | × primary | primaryTaskCompletionRate=0.8 |
| RM-008 환자 피로/이상반응 | POF-05 (즉시 중단), POF-06 (이상반응 보고) | ✅ critical (POF-05) | criticalTaskCompletionRate=1.0 |
| RM-013 AI 보조 지표 과신 | POF-07, POF-12 | ✅ critical (POF-07) | criticalTaskCompletionRate=1.0, severe unmitigated=0 |
| RM-018 부정확한 보호자 해석 | POF-12 (보호자 처방 변경 근거 오해 방지) | × primary | primaryTaskCompletionRate=0.8 |

검증 함수: `evaluateSummativeUsability` (`src/lib/usability/useScenarioValidator.ts`).
검증 케이스: TC-USABILITY-001 (`src/lib/vnv/runDeterministicChecks.ts`) — 15 명 fixture, critical/primary 경계, severe-unmitigated edge, 빈 입력 graceful, 동일 입력 동일 출력.

## 11.8 v0.5 / v0.6 / v1.0 신규 산출물 매핑 (2026-04-30 추가)

본 문서 v1.0 마감 시점 기준 모든 V&V 결정성 함수 + 외부 산출물의 위험관리 파일과의 결합 매핑이다.

| 산출물 | 결정성 함수 | TC | 영향 RM-* | 잔여위험 변동 |
| --- | --- | --- | --- | --- |
| WASM-STT 어댑터 (transformers.js) | `transcribeWithWasmStt` / `isWasmSttAvailable` | TC-STT-WASM-001 | RM-001 STT 전사 오류 / RM-002 STT 전송 경계 오해 | RM-002 S3/P3 → S2/P2 (training useCase 한정 수용 가능) |
| AI WER/CER runner | `parseWerCsv` / `evaluateWerRows` / `aggregateWer` | TC-AI-EVAL-RUNNER-001 | RM-001 / RM-014 (성능 수치 미검증 클레임) | RM-014 v1.0 후속: 실측 후 잔여위험 평가 |
| AI RTF/P95 runner | `parseRtfCsv` / `evaluateRtfRows` / `percentile` | TC-AI-RTF-RUNNER-001 | RM-001 (응답 시간 측면) | 실측 후 평가 |
| WASM STT 로드 상태 머신 | `startLoading` / `markFailed` / `friendlyMessageFor` | TC-WASM-STT-LOADING-001 | RM-001 (실패 시 사용자 안내) | 수용 가능 (head-up UX 보장) |
| 사용성평가 프로토콜 (IEC 62366) | `evaluateSummativeUsability` | TC-USABILITY-001 | RM-005/006/008/013/018 (5건) | summative 결과 후 v1.x 에서 재산정 |
| CVE 면제 등록부 | (수기 도큐멘테이션) | — | RM-015 사이버보안 취약점 | high 7건 reachability 평가 → R0/R2 분류, deferred-patch 2 + immediate-patch 1 + noop 4 |
| 2PL IRT + MFI | `estimateAbilityEap` / `pickNextItem` / `simulateAdaptiveSession` | TC-IRT-001 | RM-020 훈련 난이도 부적절 | 수용 가능 (휴리스틱 → IRT 결정성 검증, 임상 calibration 후 §3 승격) |

## 11.9 잔여위험 v1.0 재평가 (2026-04-30)

§7 잔여위험 묶음을 v0.1 (2026-04-29) 대비 재산정한다. 변동 요인: 6주간 산출물 17종 추가 (Gaze/AAC/STT 정책/WASM 어댑터/사용성평가/CVE 면제/IRT/WER+RTF runner/release manifest/SOUP/zod/HMAC/사용성 결정성 등).

| 잔여위험 묶음 | v0.1 판단 | v1.0 판단 | 변동 사유 |
| --- | --- | --- | --- |
| STT/AI 성능 | 조건부 수용 | 조건부 수용 (training useCase 한정 수용 가능) | WASM 온디바이스 ✅, WER/RTF 평가 체계 ✅, 단 60~80대 30건 실측 대기 |
| K-WAB/점수 해석 | 조건부 수용 | 조건부 수용 | 사용성평가 프로토콜 ✅, summative 실측 대기 (POF-07 critical) |
| 개인정보/보안 | 조건부 수용 | 수용 가능 (production prod) | CVE 면제 등록부 ✅, SI-04 SOUP+Manifest+CVE 도큐멘테이션 ✅ (~77%) |
| 사용대상 적합성 | 조건부 수용 | 조건부 수용 | 변동 없음 (온보딩 exclusion check 미구현) |
| 환자 불편/이상반응 | 조건부 수용 | 조건부 수용 | adverse-events ✅, POF-05 critical 사용성평가 결과 대기 |
| 측정 실패 | 대체로 수용 가능 | 수용 가능 | irisDetected/measurementQuality 표시 ✅ |
| 적응형 난이도 | (v0.1 미평가) | 조건부 수용 | IRT 결정성 ✅, 임상 calibration 대기 |

> **v1.0 마감 의미**: 1차 SaMD 신청 자료에 첨부 가능한 위험관리 파일 골격이 완성되었다. v1.x 이후 갱신은 임상/사용성평가 실측 데이터 + DTx 추가 신청 결정 + 식약처 사전상담 회신 후 진행한다.

## 갱신 이력

- 2026-04-30 **v1.0 마감**: §11.8 v0.5/v0.6/v1.0 신규 산출물 매핑 표 신설 (WASM-STT 어댑터 + WER/RTF runner + 로드 머신 + 사용성평가 + CVE 면제 + IRT 7종). §11.9 잔여위험 v1.0 재평가 표 신설 (개인정보/보안 → 수용 가능 승격, 적응형 난이도 신규 평가). 1차 SaMD 신청용 골격 완성. v1.x 이후 갱신은 실측 데이터 + 식약처 사전상담 회신 후.
- 2026-04-30 v0.5: WASM 온디바이스 STT 엔진 연결 반영. RM-001 위험통제 column 에 `wasmSttAdapter.ts` (transformers.js@4.2.0:Xenova/whisper-tiny:v0.1) + `TC-STT-WASM-001` 추가. RM-002 (서버 STT 전송 경계 오해) 의 초기 위험을 S3/P3 → S2/P2 로 재산정 (training useCase 는 rawAudioLeavesDevice=false 결정성 검증으로 evaluation useCase 와 분리). 잔여위험: training 한정 수용 가능 / evaluation 한정 조건부 수용. v1.0 은 실제 RTF/P95/KO WER 측정 후 RM-001 P 값 재평가.
- 2026-04-30 v0.4: §11.3 매핑 표에 사용성평가 5건 (RM-005 / RM-006 / RM-008 / RM-013 / RM-018) 추가, §11.7 신설 — IEC 62366 POF / critical task / DEFAULT_SUMMATIVE_CRITERIA 매핑. SR-USABILITY-017 + TC-USABILITY-001 결정성 V&V 등재. v1.0 은 실제 summative 평가 결과 (15명) 반영 후 확정 (잔여: 평가 데이터 기반 P 값 재산정, formative round 결과 통합).
- 2026-04-30 v0.3: 식별자 체계 단일화 완료. RM-021 (DoS) 신규 등재 + §5 매트릭스 추가 + §11.1 매핑 표 갱신 + §11.6 closed. `HAZARD_LINKS` (iec62304-traceability/route.ts) 와 V&V fixture (TC-IEC62304-001) 도 RM-* 로 통일. 검증: `npm run test:vnv` → 43/43 PASS.
- 2026-04-30 v0.2: §11 신설 — 결정성 V&V 함수 매핑 + IEC 62304 별지 제2호 export 연결 + 변경관리 영향평가 자동화 매핑. RM-* ↔ H-* (HAZARD_LINKS) 매핑 표 추가. v1.0 에서 식별자 체계 통합 예정.
- 2026-04-29 v0.1: 초안. 20개 RM-* 위해요인 + 위험통제 요구사항 연결 + 즉시 V&V 케이스 6개 정의.
