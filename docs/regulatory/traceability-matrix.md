# 브레인프렌즈 Traceability Matrix v0.1

작성일: 2026-04-29  
상위 문서: `claim-lock.md`, `intended-use-and-contraindications.md`, `risk-management-file.md`  
목적: 사용목적, 위험관리, 소프트웨어 요구사항, 구현 파일, V&V 테스트, 제출 증적을 한 표로 연결한다.

## 1. 현재 결론

현재 P0 위험통제 V&V는 다음 6건이 코드 증적으로 연결되어 있다.

| 위험 | V&V | 상태 |
| --- | --- | --- |
| RM-001 STT 전사 오류 | TC-RISK-001 | 구현 완료 |
| RM-009 보호자 링크 오남용 | TC-RISK-002 | 구현 완료 |
| RM-008 이상반응 누락 | TC-RISK-003 | 구현 완료 |
| RM-010 권한 없는 환자 리포트 접근 | TC-RISK-004 | 구현 완료 |
| RM-011 결과 저장 실패 | TC-RISK-005 | 구현 완료 |
| RM-019 변경관리 부재 | TC-RISK-006 | 구현 완료 |

시선 추적(Gaze)과 AAC는 Phase 1 적용 완료 상태다.

| 모듈 | 현재 적용 상태 | 남은 작업 |
| --- | --- | --- |
| Gaze | MediaPipe iris 기반 gaze metric, 세션 누적기, history payload 저장, 치료사 결과 화면 표시, dev KPI 표시, V&V 있음 | 9-point calibration UI, calibration 후 정확도 산출 |
| AAC | 심볼 데이터, AACBoard, standalone 훈련 라우트, step-2/step-4/sentence-magic “말 대신 심볼” 토글, intent API, 규칙 기반 문장 생성, audit log, V&V 있음 | 사용 빈도 정렬, 치료사 화면 utterance log 표시, ML intent 분류 |

## 2. 요구사항 추적표

| SR | 요구사항 | 위험 ID | 구현 파일 | V&V | 제출 증적 | 상태 |
| --- | --- | --- | --- | --- | --- | --- |
| SR-LOGIN-001 | 로그인 성공 후 환자 세션 진입 | RM-010, RM-015 | `src/lib/server/accountAuth.ts`, `src/lib/server/therapistReportsDb.ts` | TC-LOGIN-THERAPIST-001 | V&V 실행 로그, 접근통제 설명 | 부분 완료 |
| SR-PERMISSION-002 | 카메라·마이크 권한 차단 및 환자 리포트 접근통제 | RM-010, RM-015 | `src/lib/security/patientReportAccess.ts`, `src/lib/server/therapistReportsDb.ts` | TC-PERM-001, TC-PERM-CANCEL-001, TC-RISK-004 | 위험관리 파일, 보안 문서 | 구현 완료 |
| SR-SESSION-003 | Step 결과 저장 및 복원 | RM-011 | `src/lib/vnv/deterministicChecks.ts`, `src/lib/kwab/SessionManager.ts` | TC-HIST-001, TC-SESS-RESTORE-001, TC-STEP-FALLBACK-001, TC-RISK-005 | V&V 실행 로그 | 구현 완료 |
| SR-SCORE-004 | AQ 점수 자동 계산 | RM-005 | `src/lib/kwab/KWABScoring.ts` | TC-SCORE-001 | K-WAB 보조 채점 근거 | 구현 완료 |
| SR-HISTORY-005 | 결과 리포트 저장 및 재조회 | RM-011, RM-019 | `src/lib/vnv/deterministicChecks.ts`, `src/lib/server/historyQueries.ts`, `src/lib/server/clinicalResultsDb.ts` | TC-STORAGE-001, TC-SAVE-FAIL-001, TC-SAVE-RETRY-001, TC-RESULT-REFETCH-001, TC-RISK-005, TC-RISK-006 | V&V 실행 로그, 변경관리 문서 | 구현 완료 |
| SR-MEASURE-006 | measured / partial / demo 구분 | RM-003, RM-004 | `src/lib/vnv/deterministicChecks.ts`, `src/lib/kwab/SessionManager.ts` | TC-MQ-001 | 측정 품질 설명 | 구현 완료 |
| SR-GAZE-007 | 시선 보조 채널 결정성 산출 | RM-004 | `src/utils/faceAnalysis.ts`, `src/lib/training/gazeAccumulator.ts`, `src/components/diagnosis/FaceTracker.tsx`, `src/app/(training)/layout.tsx`, `src/lib/kwab/SessionManager.ts`, `src/app/therapist/patients/[patientId]/page.tsx`, `src/components/training/DeveloperKpiPanel.tsx` | TC-GAZE-001, TC-GAZE-002, TC-GAZE-003 | 위험관리 파일, 5채널 클레임 근거 | Phase 1 완료 |
| SR-AAC-008 | AAC 의도 템플릿 결정성 | RM-006 | `src/constants/aacData.ts`, `src/lib/aac/intentTemplate.ts`, `src/lib/aac/trainingIntegration.ts`, `src/components/aac/AACBoard.tsx`, `src/app/(training)/programs/aac/page.tsx`, `src/app/(training)/programs/step-2/page.tsx`, `src/app/(training)/programs/step-4/page.tsx`, `src/components/lingo/SentenceMagicGame.tsx`, `src/app/api/aac/intent/route.ts` | TC-AAC-001, TC-AAC-002 | 위험관리 파일, 5채널 클레임 근거 | Phase 1 완료 |
| SR-STT-009 | STT useCase 정책, review-required, 버전 메타데이터 | RM-001, RM-002, RM-019 | `src/lib/speech/sttPolicy.ts`, `src/lib/speech/sttRuntime.ts`, `src/lib/speech/sttClientPreflight.ts`, `src/lib/speech/wasmSttAdapter.ts`, `src/lib/speech/sttPrompt.ts`, `src/lib/speech/sttReview.ts`, `src/lib/speech/SpeechAnalyzer.ts`, `src/components/lingo/SentenceMagicGame.tsx`, `src/app/api/proxy/stt/route.ts`, `src/lib/analysis/versioning.ts` | TC-STT-001, TC-STT-002, TC-STT-003, TC-RISK-001, TC-RISK-006 | 클레임 잠금표, 데이터 전송 명세 필요 | mock/wasm/server/blocked 분리 완료, WASM 엔진 미연결 |
| SR-GUARDIAN-010 | 보호자 주간 리포트 요약 | RM-009, RM-018 | `src/lib/guardian/weeklyReportSummary.ts`, `src/lib/server/guardianReportsDb.ts`, `src/app/api/guardian/report-link/route.ts`, `src/app/guardian/[token]/page.tsx` | TC-GUARDIAN-001, TC-RISK-002 | 위험관리 파일, 보호자 리포트 설명 | 구현 완료 |
| SR-AE-011 | 이상반응 조회 및 중증 미확인 분류 | RM-008 | `src/lib/adverse-events/adverseEventReview.ts`, `src/lib/server/adverseEventsDb.ts`, `src/app/api/adverse-events/route.ts`, `src/app/api/adverse-events/me/route.ts` | TC-RISK-003 | 이상반응 DB 스키마, 위험관리 파일 | 구현 완료 |

## 3. 위험관리 추적표

| RM | 위험 | 연결 SR | 주요 통제 | V&V | 잔여 상태 |
| --- | --- | --- | --- | --- | --- |
| RM-001 | STT 전사 오류 | SR-STT-009 | STT useCase 정책, reviewRequired, prompt biasing, 치료사 검토 경계 | TC-STT-001, TC-RISK-001 | 조건부 수용 |
| RM-002 | 서버 STT 데이터 전송 경계 오해 | SR-STT-009 | 클레임 하향, useCase 추적, rawAudioLeavesDevice 기록, 훈련 useCase client preflight 차단, 데이터 전송 명세 | TC-STT-001, TC-STT-002, TC-RISK-006 | 조건부 수용. `cloud-and-data-transfer.md` 작성 완료 |
| RM-003 | 안면 랜드마크 측정 실패 | SR-MEASURE-006 | 측정 품질, fallback, 치료사 검토 | TC-MQ-001 | 수용 가능 |
| RM-004 | 시선 측정 실패 또는 오해 | SR-GAZE-007, SR-MEASURE-006 | irisDetected, attentionRatio, offTaskRatio, 측정 품질, 치료사 참고 표시 | TC-GAZE-001, TC-GAZE-002, TC-GAZE-003 | 수용 가능 |
| RM-005 | K-WAB 보조 점수의 진단 오해 | SR-SCORE-004 | 자동 진단 금지, 보조 채점 표현, 치료사 검토 | TC-SCORE-001 | 조건부 수용. 결과지 문구/사용성평가 필요 |
| RM-006 | AAC 문장 생성 오해 | SR-AAC-008 | 규칙형 변환 명시, unknownIds, preview, inputModality=aac 추적 | TC-AAC-001, TC-AAC-002 | 수용 가능 |
| RM-007 | 부적절한 대상자 사용 | 문서 통제 | 포함/제외 기준, 금기·주의사항 | 문서 검토 | 조건부 수용. 온보딩 exclusion 체크 필요 |
| RM-008 | 환자 피로·불편 누락 | SR-AE-011, SR-GUARDIAN-010 | 이상반응 신고, 중증 미확인 분류, 보호자 리포트 반영 | TC-RISK-003 | 조건부 수용 |
| RM-009 | 보호자 링크 오남용 | SR-GUARDIAN-010 | 토큰, 만료, 폐기, read-only, audit | TC-GUARDIAN-001, TC-RISK-002 | 조건부 수용 |
| RM-010 | 권한 없는 치료사 접근 | SR-LOGIN-001, SR-PERMISSION-002 | admin/담당 치료사만 접근, 비담당 차단 | TC-RISK-004 | 조건부 수용 |
| RM-011 | 결과 저장 실패 | SR-SESSION-003, SR-HISTORY-005 | compact/server-only fallback, 재시도, 수동 검토, 서버 우선 | TC-SAVE-FAIL-001, TC-SAVE-RETRY-001, TC-RISK-005 | 조건부 수용 |
| RM-012 | 반응시간 왜곡 | SR-MEASURE-006 | 보조 지표 제한, 동일 환경 비교 | TC-MQ-001 | 수용 가능 |
| RM-013 | AI 보조 지표의 과신 | claim-lock, ai-role-boundary | AI 보조 역할 경계, 치료사 검토, 모듈별 금지 사용 정의 | 문서 검토 | 조건부 수용. UI/리포트 문구 반영 필요 |
| RM-014 | 성능 수치 미검증 클레임 | claim-lock | WER/P95 목표치 표현 제한 | 문서 검토 | 조건부 수용. 평가셋 필요 |
| RM-015 | 사이버보안 취약점 | SR-LOGIN-001, SR-PERMISSION-002 | 접근통제, 감사로그, 보안 문서 | TC-RISK-004 | 조건부 수용. SBOM/취약점 증적 필요 |
| RM-016 | 감사로그 부족 | 운영 문서 | access audit, clinical audit | 코드 검토 | 조건부 수용 |
| RM-017 | 개인정보/PHI 혼재 | 운영 문서 | PII/PHI 분리 정책 | 문서 검토 | 조건부 수용 |
| RM-018 | 부정확한 보호자 해석 | SR-GUARDIAN-010 | read-only, 요약 제한, 의료진 문의 안내 | TC-GUARDIAN-001 | 수용 가능 |
| RM-019 | 변경관리 부재 | SR-STT-009, SR-HISTORY-005 | versionSnapshot, STT metadata, prompt hash | TC-RISK-006 | 조건부 수용 |
| RM-020 | 훈련 난이도 부적절 | 후속 SR 필요 | 치료사 처방 우선, IRT 클레임 하향 | 미구현 | 조건부 수용. IRT/난이도 SR 필요 |

## 4. V&V 케이스 인덱스

| TC | 검증 내용 | 연결 SR | 연결 RM |
| --- | --- | --- | --- |
| TC-SCORE-001 | K-WAB AQ 결정성 | SR-SCORE-004 | RM-005 |
| TC-MQ-001 | 측정 품질 measured/partial/demo | SR-MEASURE-006 | RM-003, RM-012 |
| TC-HIST-001 | history 병합·보관 상한 | SR-SESSION-003, SR-HISTORY-005 | RM-011 |
| TC-LOGIN-THERAPIST-001 | 역할별 라우팅 | SR-LOGIN-001 | RM-010 |
| TC-STORAGE-001 | raw media compact 저장 | SR-SESSION-003, SR-HISTORY-005 | RM-011, RM-017 |
| TC-PERM-001 | 권한 거부 차단 | SR-PERMISSION-002 | RM-015 |
| TC-PERM-CANCEL-001 | 권한 흐름 취소 차단 | SR-PERMISSION-002 | RM-015 |
| TC-SAVE-FAIL-001 | 저장 실패 compact fallback | SR-HISTORY-005 | RM-011 |
| TC-SAVE-RETRY-001 | 서버 저장 재시도 | SR-HISTORY-005 | RM-011 |
| TC-RISK-005 | 저장 실패 종합 위험통제 | SR-SESSION-003, SR-HISTORY-005 | RM-011 |
| TC-SESS-RESTORE-001 | 세션 복원 | SR-SESSION-003 | RM-011 |
| TC-STEP-FALLBACK-001 | step fallback source | SR-SESSION-003, SR-HISTORY-005 | RM-011 |
| TC-RESULT-REFETCH-001 | 서버/로컬 불일치 서버 우선 | SR-HISTORY-005 | RM-011 |
| TC-GAZE-001 | gaze metric 결정성 | SR-GAZE-007 | RM-004 |
| TC-GAZE-002 | gaze accumulator 결정성 | SR-GAZE-007 | RM-004 |
| TC-GAZE-003 | gaze history summary 저장 결정성 | SR-GAZE-007, SR-HISTORY-005 | RM-004, RM-011 |
| TC-AAC-001 | AAC intent template 결정성 | SR-AAC-008 | RM-006 |
| TC-AAC-002 | AAC 훈련 통합 payload 결정성 | SR-AAC-008, SR-HISTORY-005 | RM-006, RM-011 |
| TC-STT-001 | STT 정책 결정성 | SR-STT-009 | RM-001, RM-002 |
| TC-STT-002 | STT client preflight 서버 업로드 차단 | SR-STT-009 | RM-002 |
| TC-STT-003 | STT runtime mock/wasm/server/blocked 분리 | SR-STT-009 | RM-001, RM-002 |
| TC-RISK-001 | STT 실패 review-required | SR-STT-009 | RM-001 |
| TC-GUARDIAN-001 | 보호자 리포트 요약 | SR-GUARDIAN-010 | RM-009, RM-018 |
| TC-RISK-002 | 보호자 링크 만료/폐기 | SR-GUARDIAN-010 | RM-009 |
| TC-RISK-003 | 이상반응 조회·분류·리포트 반영 | SR-AE-011, SR-GUARDIAN-010 | RM-008 |
| TC-RISK-004 | 환자 리포트 접근통제 | SR-PERMISSION-002 | RM-010 |
| TC-RISK-006 | AI/STT 버전 메타데이터 | SR-STT-009, SR-HISTORY-005 | RM-019 |

## 5. Gaze 적용 상세

현재 적용된 항목:

- `src/utils/faceAnalysis.ts`: `calculateGazeMetrics(landmarks)` 구현
- `src/components/diagnosis/FaceTracker.tsx`: FaceLandmarker 결과에서 gaze 필드 생성
- `src/app/(training)/TrainingContext.tsx`: sidebar metric에 gaze 필드 추가
- `src/app/(training)/layout.tsx`: gaze metric을 sidebar와 `gazeAccumulator`에 전달
- `src/lib/training/gazeAccumulator.ts`: attentionRatio, offTaskRatio, irisDetectionRatio, measurementQuality 산출
- `src/lib/kwab/SessionManager.ts`: `TrainingHistoryEntry.gazeSummary`에 세션 요약 저장
- `src/app/therapist/patients/[patientId]/page.tsx`: 치료사 상세 화면에 응시율, 이탈 비율, 홍채 검출률, 샘플 수 표시
- `src/components/training/DeveloperKpiPanel.tsx`: dev KPI 시각화
- `src/lib/vnv/runDeterministicChecks.ts`: `TC-GAZE-001`, `TC-GAZE-002`, `TC-GAZE-003`

현재 남은 항목:

- 9-point calibration UI
- calibration 후 gaze 정확도 산출

## 6. AAC 적용 상세

현재 적용된 항목:

- `src/constants/aacData.ts`: subject, intent, noun 심볼 데이터
- `src/lib/aac/intentTemplate.ts`: 선택 sequence를 한국어 문장으로 변환
- `src/components/aac/AACBoard.tsx`: 심볼 보드 UI
- `src/app/(training)/programs/aac/page.tsx`: standalone AAC 훈련 라우트
- `src/app/(training)/programs/step-2/page.tsx`: 복창 훈련에서 “말 대신 심볼” 입력 지원
- `src/app/(training)/programs/step-4/page.tsx`: 상황 설명 훈련에서 “말 대신 심볼” 입력 지원
- `src/components/lingo/SentenceMagicGame.tsx`: 문장 게임에서 “말 대신 심볼” 입력 지원
- `src/lib/aac/trainingIntegration.ts`: AAC 훈련 payload metadata와 transcript scoring helper
- `src/app/api/aac/intent/route.ts`: 선택 sequence 저장 및 서버측 문장 재생성
- `src/lib/vnv/runDeterministicChecks.ts`: `TC-AAC-001`, `TC-AAC-002`

현재 남은 항목:

- AAC 사용 빈도 기반 정렬
- 치료사 결과 화면에서 AAC utterance intent log 표시
- ML 기반 intent 분류는 Phase 2로 보류

## 7. 다음 산출물

다음 작업은 AAC 로그를 치료사 화면에 표시하는 것이다.

이유:

- Gaze는 Phase 1 구현·V&V·history 저장·치료사 표시까지 연결됐다.
- AAC는 Phase 1 구현·V&V·주요 훈련 화면 통합까지 연결됐다.
- 제품제안서의 5채널 멀티모달 클레임을 더 강하게 방어하려면, standalone 기능보다 실제 훈련 흐름 안에 녹이는 작업이 필요하다.
- PM 권고 다음 순서는 AAC utterance log를 치료사 화면에 표시하는 것이다.
