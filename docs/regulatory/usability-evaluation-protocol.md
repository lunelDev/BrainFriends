# 브레인프렌즈 사용성평가 프로토콜 v0.1

작성일: 2026-04-30
근거: IEC 62366-1:2015 + AMD1:2020 / 식약처 디지털의료기기 GMP 가이드라인 [별표3] 1.1.6 / PDF #7 §III.2.바 (디지털치료기기 첨부서류 - 사용적합성)
관련 문서: `claim-lock.md` v0.1.5, `intended-use-and-contraindications.md`, `risk-management-file.md` v0.3, `digital-medical-product-gap-matrix.md`
적용 범위: 1차 허가 범위의 독립형 디지털의료기기소프트웨어 (SaMD) — 뇌졸중·외상성뇌손상 후 실어증·마비말장애 환자 언어재활 보조

## 1. 목적

이 문서는 IEC 62366-1 §5.4~5.9 절차에 따라 브레인프렌즈의 사용적합성공학 (usability engineering) 활동을 사전 정의한다. 본 프로토콜은 식약처 디지털치료기기 인허가 첨부서류 §III.2.바 "사용적합성" 산출물의 골격이며, 임상시험 IRB 와는 별도의 사용성평가 IRB 또는 위탁시험기관 평가로 진행된다.

본 문서는 평가 결과 보고서가 아니다. 평가 진행 후 결과는 별도의 `usability-evaluation-report-v1.0.md` 로 기록한다.

## 2. 사용목적과 사용자 그룹

### 2.1 사용목적 (intended use)

브레인프렌즈는 뇌졸중, 외상성 뇌손상, 기타 뇌질환 이후 발생한 실어증 또는 마비말장애 환자를 대상으로, 의료진의 관리하에 언어재활 훈련 수행과 경과 모니터링을 보조하기 위해 사용하는 독립형 디지털의료기기소프트웨어이다.

### 2.2 의도된 사용자 그룹 (intended user profiles)

| ID | 사용자 그룹 | 특성 | 우선 검증 모집단 |
| --- | --- | --- | --- |
| U1 | 환자 (1차 사용자) | 뇌질환 후 실어증·마비말장애 성인. 60~80대 비중 높음. 한국어 모국어. 스마트기기 사용 경험 폭넓음 (저~중) | 60~80대 중점 |
| U2 | 치료사·의사 (2차 사용자) | 언어치료사 (SLP), 재활의학과·신경과 의사. K-WAB 평가 경험 보유 | 기관 임상가 |
| U3 | 보호자 (3차 사용자) | 환자 가족. 50~70대 비중 높음. 의료 전문성 없음 | 환자 동거인 |

### 2.3 사용 환경 (use environment)

| 환경 | 특성 | 사용성 영향 |
| --- | --- | --- |
| 가정 | 일반 거실, 조명 변동, 가족 소음, 환자 단독 또는 보호자 동반 | 조도 변동 → 안면 측정 품질, 소음 → STT 품질 |
| 외래 클리닉 | 치료실, 균일 조도, 정숙, 치료사 1:1 | 표준 환경. 측정 quality baseline |
| 입원 병동 | 병상, 침대 각도 변동, 다인실 소음, 보호자 또는 간병인 보조 | 자세 → 안면 framing, 다인실 → 사생활 |

## 3. Primary Operating Functions (POF) 식별 — IEC 62366-1 §5.4

### 3.1 POF 정의 기준

본 가이드라인에서 "primary operating function" 은 잘못 수행되었을 때 (1) 환자 안전, (2) 임상 결정의 신뢰성, (3) 개인정보 보호, (4) 측정 데이터 신뢰성에 영향을 줄 수 있는 사용자 작업으로 정의한다.

### 3.2 POF 목록

| POF ID | POF 명 | 사용자 그룹 | Critical | 위험통제 (RM-*) |
| --- | --- | --- | --- | --- |
| POF-01 | 환자 로그인 후 세션 진입 | U1 | × | RM-010, RM-015 |
| POF-02 | 카메라·마이크 권한 부여 후 훈련 시작 | U1 | × | RM-002, RM-003 |
| POF-03 | step-1~step-6 훈련 수행 (음성 발화 + 안면 측정) | U1 | × | RM-001, RM-003, RM-004, RM-008, RM-012 |
| POF-04 | AAC 보드로 발화 의도 commit (말 대신 심볼) | U1 | × | RM-006 |
| POF-05 | 훈련 중 불편·피로·통증 시 즉시 중단 | U1 | ✅ critical | RM-008 |
| POF-06 | 이상반응 보고 입력 | U1, U2 | × | RM-008, RM-016 |
| POF-07 | K-WAB 보조 점수 검토 후 치료사가 확정 | U2 | ✅ critical | RM-005, RM-013 |
| POF-08 | 환자 처방·follow-up 메모 작성 | U2 | × | RM-007, RM-016, RM-019 |
| POF-09 | 환자 리포트 (history/AQ 추이) 검토 | U2 | × | RM-010, RM-013 |
| POF-10 | 보호자 read-only 리포트 링크 발급 | U2 | × | RM-009 |
| POF-11 | 보호자가 read-only 리포트 링크로 주간 요약 확인 | U3 | × | RM-009, RM-018 |
| POF-12 | 보호자가 리포트 표현을 의료진 처방 변경 근거로 오해하지 않음 | U3 | × | RM-013, RM-018 |

### 3.3 Critical Task 분리

IEC 62366-1 §3.7 critical task 정의 (failure → unacceptable risk after risk control). 본 프로토콜의 critical task 는 다음 두 항목으로 한정한다.

- **POF-05**: 훈련 중 불편 시 즉시 중단 — 실패 시 환자 안전 (피로·통증 누적)
- **POF-07**: 치료사가 K-WAB 자동 점수를 검토 없이 그대로 확정 → 잘못된 임상 판단 (RM-005 / RM-013)

기타 POF 는 primary 이지만 critical 은 아니다 (recoverable 또는 의료진 검토 단계가 추가 통제 역할).

## 4. Use Scenario 정의 — IEC 62366-1 §5.5

### 4.1 시나리오 양식

각 use scenario 는 다음 6 필드로 정의한다.

- taskId (예: T-PATIENT-LOGIN)
- description (한국어 1~2 문장)
- userGroup (patient / therapist / guardian)
- primaryOperatingFunction (boolean — POF 인지)
- criticalTask (boolean — failure → unacceptable risk)
- hazardLinks (RM-* 배열)
- expectedOutcome

본 양식은 `src/lib/usability/useScenarioValidator.ts` 의 `UseScenario` 타입과 1:1 대응한다. 시나리오 데이터셋은 `data/usability/scenarios.json` 으로 관리하고 평가 시점 git SHA 를 함께 기록한다.

### 4.2 핵심 시나리오 12종 (POF ↔ TC 매핑)

| Scenario ID | POF | 사용자 | 시작 상태 | 주요 동작 | 기대 결과 |
| --- | --- | --- | --- | --- | --- |
| T-PATIENT-LOGIN | POF-01 | U1 | 앱 첫 화면 | 아이디·비밀번호 입력, 로그인 버튼 | 환자 세션 진입, step-1 화면 표시 |
| T-PATIENT-PERMISSION | POF-02 | U1 | 권한 요청 화면 | 카메라·마이크 권한 허용 | 훈련 화면 진입 |
| T-PATIENT-STEP1-SPEECH | POF-03 | U1 | step-1 단어 따라 말하기 | 5 단어 발화 | 결과 화면, 측정 품질 표시 |
| T-PATIENT-STEP4-SENTENCE | POF-03 | U1 | step-4 문장 산출 | 1 문장 발화, 30초 이내 | transcript 표시, reviewRequired 명시 |
| T-PATIENT-AAC-COMMIT | POF-04 | U1 | AAC 보드 (말 대신 심볼) | 주어+의도+명사 3 심볼 commit | intent sentence 생성, 보호자 알림 (옵션) |
| T-PATIENT-INTERRUPT | POF-05 | U1 | step 진행 중 | "그만하기" 또는 "쉬기" 버튼 | 훈련 즉시 중단, 부분 결과 저장, 이상반응 입력 안내 |
| T-PATIENT-AE-REPORT | POF-06 | U1 | 훈련 종료 후 | 카테고리·중증도 선택 후 입력 | 이상반응 등록, 치료사 알림 큐 진입 |
| T-THERAPIST-KWAB-REVIEW | POF-07 | U2 | 치료사 환자 상세 | 자동 점수 표 검토, 의문점 표시 | 자동 점수에 동의 / 반려 / 메모 — **critical** |
| T-THERAPIST-PRESCRIPTION | POF-08 | U2 | 치료사 환자 상세 | 새 처방 작성 (mode + 횟수 + 만료일) | 처방 발행, 환자 측 표시 |
| T-THERAPIST-REPORT-VIEW | POF-09 | U2 | 치료사 환자 history 탭 | 최근 7~30일 추이 그래프 검토 | 추이 시각화, 부적절 데이터 식별 |
| T-THERAPIST-GUARDIAN-LINK | POF-10 | U2 | 치료사 환자 상세 | 보호자 링크 발급 버튼 | 토큰 기반 링크 생성, TTL 표시 |
| T-GUARDIAN-REPORT-VIEW | POF-11, POF-12 | U3 | 보호자 카톡/메일 링크 | 링크 클릭 후 read-only 페이지 진입 | 주간 요약 표시. "처방 변경 근거 아님" 안내문 식별 |

### 4.3 Hazard Related Use Scenarios (HRUS)

`src/lib/usability/useScenarioValidator.ts` 의 `buildHazardCoverage()` 가 위 12 시나리오의 `hazardLinks` 를 집계해 RM-001 ~ RM-021 중 어느 위해요인이 사용성평가로 검증되는지를 결정성으로 산출한다. v0.1 적용 범위에서 검증되는 위해요인은 다음과 같다.

| RM-* | 검증하는 시나리오 | 비고 |
| --- | --- | --- |
| RM-001 STT 전사 오류 | T-PATIENT-STEP1-SPEECH, T-PATIENT-STEP4-SENTENCE | 측정 품질 표시 + reviewRequired 명시 식별 여부 |
| RM-002 STT 전송 경계 오해 | T-PATIENT-STEP4-SENTENCE | 사용자가 "데이터가 어디로 가는가" 안내문을 인지하는가 |
| RM-003 안면 측정 실패 | T-PATIENT-PERMISSION, T-PATIENT-STEP1-SPEECH | 측정 품질 표시 인식 |
| RM-004 시선 측정 오해 | T-PATIENT-STEP1-SPEECH | 보조 지표 표시가 진단으로 오해되지 않는가 |
| RM-005 K-WAB 진단 오해 | T-THERAPIST-KWAB-REVIEW (**critical**) | 자동 점수에 대해 검토 없이 확정하는 use error 발생 여부 |
| RM-006 AAC 문장 생성 오해 | T-PATIENT-AAC-COMMIT | 환자가 의도와 다른 심볼 commit 시 보호자가 환자 의도로 단정하는 use error |
| RM-008 환자 피로/이상반응 | T-PATIENT-INTERRUPT (**critical**), T-PATIENT-AE-REPORT | 중단 버튼 인지/사용, 이상반응 입력 흐름 완주 |
| RM-009 보호자 링크 오남용 | T-THERAPIST-GUARDIAN-LINK, T-GUARDIAN-REPORT-VIEW | 만료/폐기 표시 인식, 링크 외부 공유 행동 관찰 |
| RM-010 권한 없는 치료사 접근 | T-PATIENT-LOGIN, T-THERAPIST-REPORT-VIEW | 비담당 치료사가 타 환자 검색 시도 |
| RM-013 AI 보조 지표 과신 | T-THERAPIST-KWAB-REVIEW, T-GUARDIAN-REPORT-VIEW | 보조 지표 표현 / explainability 인지 |
| RM-016 감사로그 부족 | T-THERAPIST-PRESCRIPTION | 처방·메모 변경이 감사로그로 기록됨을 사용자가 이해 |
| RM-018 부정확한 보호자 해석 | T-GUARDIAN-REPORT-VIEW | 처방 변경 근거 오해 use error |

## 5. 평가 단계 — IEC 62366-1 §5.6~5.8

본 장은 IEC 62366-1 요구사항 중 형성 평가 계획서 요약(§5.7.1), 형성 평가 결과보고서 요약(§5.7.2), 사용 전 훈련 필요성(§5.8)을 함께 대응한다. 실제 평가 완료 전까지는 "계획" 상태이며, 평가 후 `usability-evaluation-report-v1.0.md`에 결과와 설계 변경 사항을 기록한다.

### 5.1 Formative Evaluation (반복 설계 평가)

| 항목 | 값 |
| --- | --- |
| 목적 | 잠재 use error / 사용성 결함 식별, UI 반복 개선 |
| 평가 대상 사용자 인터페이스 | 환자 로그인/세션 진입, 카메라·마이크 권한 화면, step-1/step-4 훈련 화면, AAC 보드, 훈련 중단/이상반응 입력, 치료사 K-WAB 검토/처방/리포트 화면, 보호자 read-only 리포트 |
| 참여자 수 | round 1: 5명 / round 2: 5명 / round 3 (필요 시): 5~8명 |
| 사용자 그룹 | round 1: U1 환자 3 + U2 치료사 2 / round 2: U1 5 / round 3: U3 보호자 5 |
| 평가 시점 | round 1: 핵심 훈련·치료사 검토 흐름 동작 가능 시점 / round 2: round 1 설계 변경 반영 후 / round 3: 보호자 리포트와 AAC 흐름 확정 후 |
| 환경 | 사용성 랩 또는 외래 클리닉 시뮬레이션 |
| 사용 조건 | 의도된 사용자를 대표하는 참여자가 실제 사용환경을 모사한 조도·소음·장비 조건에서 수행 |
| 부속 문서 | 피험자 설명문, 동의서, 모집공고문, 평가자 스크립트, 시나리오 카드, 관찰기록지, 이상반응/중단 기록지 |
| 사전 교육 | 제품 소개 5분 이내, 과제 목적 안내 5분 이내. 치료사는 대시보드 주요 용어 교육 10분 이내. 교육 종료 후 최소 5분 경과 뒤 시험 시작 |
| 데이터 수집 | think-aloud, 화면 녹화, 시선 (선택), 후속 인터뷰 |
| 합격기준 | 별도 합격기준 없음. 식별된 use error 는 위험관리 파일과 설계로 환류 |
| 종료 조건 | 라운드 간 신규 critical use error 발생 0 또는 누적 식별 24건 도달 |

### 5.1.1 Formative Evaluation Plan Summary — IEC 62366-1 §5.7.1

| 요구사항 | 브레인프렌즈 대응 |
| --- | --- |
| 형성 평가의 목적과 방법 | 잠재 use error 식별, 치료사 검토 흐름 검증, UI 반복 개선. Think-aloud, 관찰, 화면/음성 녹화, 후속 인터뷰를 사용한다. |
| 포함될 사용자 인터페이스 | U1 환자 훈련 UI, U2 치료사 검토 UI, U3 보호자 리포트 UI, 권한/중단/이상반응/AAC UI를 포함한다. |
| 각 사용자 인터페이스 평가 시점 | 기능별 개발 완료 후 round 1~3로 나누어 수행한다. 설계 변경 후 같은 시나리오를 재평가한다. |
| 사용자 그룹 대표 참가자 | U1 환자, U2 치료사·의사, U3 보호자가 각 round에 포함된다. |
| 사용환경과 사용조건 | 가정, 외래 클리닉, 입원 병동 조건을 시뮬레이션하고 조도, 소음, 카메라/마이크 권한, 네트워크 상태를 기록한다. |
| 제공 부속 문서 | 동의서, 설명문, 평가자 스크립트, 시나리오 카드, 관찰기록지, 오류 분류표, 데이터 폐기 안내를 제공한다. |
| 사전 교육과 최소 경과시간 | 사용자군별 5~10분 교육 후 최소 5분 경과 뒤 평가를 시작한다. 실제 평가기관 요구 시 경과시간을 조정한다. |

### 5.1.2 Formative Evaluation Result Report Summary — IEC 62366-1 §5.7.2

형성 평가 완료 후 결과보고서는 아래 항목을 반드시 포함한다.

| 보고 항목 | 기록 방식 |
| --- | --- |
| 핵심 결과 | round별 완료율, use error 수, severe/moderate/minor 분포, critical task 실패 여부 |
| 설계 변경 사항 | 변경 전/후 화면, 변경 사유, 연결된 RM-*, 재평가 필요 여부 |
| 총괄 평가 계획에 영향을 미칠 중대한 발견 | summative 시나리오 추가/삭제, critical task 승격, 사용자군 추가, 평가환경 변경 필요 여부 |
| 잔여 use error | mitigated 여부와 위험관리 파일 반영 상태 |
| 다음 라운드 조건 | 신규 critical use error 0건 또는 설계 변경 검증 완료 여부 |

### 5.2 Summative Evaluation (확정 평가)

| 항목 | 값 |
| --- | --- |
| 목적 | 잔여 사용성 위험 검증, 합격기준 통과 입증 |
| 참여자 수 | 최소 15명 (FDA Guidance "Applying Human Factors and Usability Engineering" 권장 하한) |
| 사용자 그룹 분포 | U1 환자 8 + U2 치료사 4 + U3 보호자 3 (목표). 환자 8명은 60~80대 5 + 50대 이하 3 |
| 환경 | 외래 클리닉 시뮬레이션 + 가정 환경 시뮬레이션 (조도 변동, 일반 소음) |
| 데이터 수집 | 작업 완료 여부, 작업 시간, 오류 횟수, 발생한 use error 의 description / severity / hazardLinks / mitigated 여부 |
| 합격기준 | §6 acceptance criteria 표 참조. `evaluateSummativeUsability(scenarios, observations, DEFAULT_SUMMATIVE_CRITERIA)` 결정성 산출 결과로 판정 |

### 5.3 진행 절차

1. IRB 또는 위탁시험기관 사전 검토 → 본 프로토콜 v0.1 + IRB 부속자료 제출
2. 참여자 모집 (포함/제외 기준은 별도 모집 SOP). PHI 수집은 최소화 + maskPhi 처리
3. 사전 동의 (informed consent) — 영상·음성 녹화 동의 별도 명시. 동의 철회 시 데이터 즉시 폐기
4. 사용 시나리오 1 ~ 12 순차 수행. 평가자는 think-aloud 만 안내, 사용자에게 힌트 제공 금지
5. 작업 종료 후 후속 인터뷰 (15분 이내) — System Usability Scale (SUS) + 자유 응답
6. 데이터 입력 — `data/usability/observations-v1.json` 양식. 식별정보 분리 저장
7. 분석 — `evaluateSummativeUsability` 결정성 산출 + 식별된 use error 별 위험관리 파일 갱신 트리거 평가
8. 보고서 — `docs/regulatory/usability-evaluation-report-v1.0.md` 작성

### 5.4 사용 전 훈련 설계 — IEC 62366-1 §5.8

의도된 사용자가 안전하게 제품을 사용하기 위해 훈련이 필요한 경우, 다음 중 최소 하나 이상의 방식으로 제공한다.

| 훈련 제공 방식 | 브레인프렌즈 적용 |
| --- | --- |
| 훈련에 필요한 자료를 제조자가 제공 | 환자용 빠른 시작 안내, 치료사용 검토 가이드, 보호자 리포트 해석 안내를 문서 또는 화면 안내로 제공 |
| 훈련에 필요한 자료를 사용자가 수급 | 의료기관이 자체 교육자료 또는 기관 SOP에 맞게 보완 가능 |
| 훈련 프로그램을 제조자 또는 제3자 전문기관이 제공 | 사용성평가 또는 도입기관 교육 시 치료사/운영자 대상 30~60분 교육 세션 제공 |

훈련자료의 최신 버전, 제공일, 교육자, 교육 대상, 참석자, 시험 시작 전 경과시간은 평가 기록에 포함한다.

## 6. Acceptance Criteria — IEC 62366-1 §5.9

### 6.1 결정성 합격기준 (DEFAULT_SUMMATIVE_CRITERIA)

`src/lib/usability/useScenarioValidator.ts` 의 `DEFAULT_SUMMATIVE_CRITERIA` 가 본 프로토콜의 합격선과 1:1 대응한다.

| 항목 | 값 | 근거 |
| --- | --- | --- |
| criticalTaskCompletionRate | 1.00 (100%) | IEC 62366-1 §5.9 — critical task failure → unacceptable. 본 프로토콜의 critical 은 POF-05 / POF-07 |
| primaryTaskCompletionRate | 0.80 (80%) | FDA HF guidance 통상값. POF-01~04, POF-06, POF-08~12 적용 |
| maxUnmitigatedSevereUseErrors | 0 | 모든 severe use error 는 평가 후 위험관리 파일 갱신 + 설계 통제로 mitigated 표기되어야 함 |

### 6.2 자동 산출 결과

`evaluateSummativeUsability()` 의 출력 `SummativeEvaluationResult.summativePass = (failureReasons.length === 0)`. failureReasons 는 다음 4 종으로 알파벳 정렬된다.

- `critical_task_below_threshold:<taskIds>` — POF-05 / POF-07 시나리오 1건이라도 100% 미만
- `primary_task_below_threshold:<taskIds>` — POF primary 시나리오 80% 미만
- `severe_use_errors_unmitigated:N>0` — mitigated=false 의 severe use error 가 1건 이상
- `no_participants_recorded` — 데이터 미입력 (sanity check)

### 6.3 합격기준 미달 시 후속 조치

| 사유 | 1차 조치 | 2차 조치 |
| --- | --- | --- |
| critical 미달 | 위험관리 파일 §5 영향받는 RM-* 재평가, 설계 변경 → re-summative | 클레임 잠금 §3 ↘ §4 또는 §5 강등 |
| primary 미달 | UI/온보딩 개선 + 사용자 매뉴얼 보강 → re-summative | 해당 POF 사용 환경 제한 명시 |
| severe unmitigated | 추가 risk control 도입 → 위험관리 파일 갱신 → re-summative | 해당 기능 제거 또는 임상시험 단계 추가 |

## 7. Use Error 분류 및 기록

### 7.1 정의 (IEC 62366-1 §3.21)

> "use error: user action or lack of user action while using the medical device that leads to a different result than that intended by the manufacturer or expected by the user"

본 프로토콜에서 use error 는 §4 시나리오 별 expectedOutcome 과 다른 결과로 정의한다. 사용자 책임을 묻기 위한 분류가 아니라 위험통제 보강 트리거이다.

### 7.2 분류 양식

`UseErrorRecord` (`src/lib/usability/useScenarioValidator.ts`) 와 동일한 구조로 기록한다.

| 필드 | 의미 |
| --- | --- |
| errorId | 평가 round 내 stable id (예: F1-UE-001) |
| taskId | 발생 시나리오 |
| participantId | 참여자 가명 ID |
| description | 한국어 1~2 문장 사실 기술 (사용자 비난 표현 금지) |
| severity | minor / moderate / severe |
| hazardLinks | 트리거된 RM-* (다중 가능) |
| mitigated | 평가팀이 추가 위험통제 적용 후 잔여위험 수용 가능 여부 |

### 7.3 Severity 기준

| 등급 | 정의 | 예시 |
| --- | --- | --- |
| minor | 작업은 완료되었으나 비효율 발생 | 처음에 잘못된 메뉴 클릭 후 회복 |
| moderate | 작업 일부 누락, 중간 정도 사용성 결함 | 측정 품질 표시 미인지 → 부정확한 보조 지표 그대로 사용 |
| severe | 작업 실패 또는 안전·임상 판단·개인정보 영향 | 치료사가 K-WAB 자동 점수를 검토 없이 확정, 보호자 링크 SNS 공유 |

### 7.4 Abnormal Use 분리

IEC 62366-1 §3.1 "abnormal use" (의도된 사용 범위 외, 합리적으로 예측 불가) 는 사용성평가 결과에서 use error 와 분리해 별도 기록한다. abnormal use 는 위험관리 파일의 갱신 트리거가 아니다 (단, 빈도가 높으면 사용목적 재평가 트리거).

## 8. 결정성 V&V 매핑

### 8.1 SR-USABILITY-017

본 프로토콜의 모든 합격기준은 SR-USABILITY-017 요건과 결정성 V&V 함수 (`useScenarioValidator.ts`) 로 자동 검증된다.

| 본 문서 § | 결정성 함수 | 검증 |
| --- | --- | --- |
| §3.2 POF 목록 | `normalizeScenarios()` | taskId 알파벳 정렬, 중복 last-wins |
| §5 평가 단계 | `buildTaskCompletionStats()` | (participantId, taskId) last-wins, completion rate 산출 |
| §6.1 합격기준 | `evaluateSummativeUsability()` | DEFAULT_SUMMATIVE_CRITERIA 매칭, summativePass 산출 |
| §7.3 use error severity | `bucketUseErrors()` | minor → moderate → severe 고정 순서 |
| §4.3 HRUS | `buildHazardCoverage()` | hazardId 와 verifiedByTaskIds 알파벳 정렬 |

검증 케이스: TC-USABILITY-001 (`src/lib/vnv/runDeterministicChecks.ts`)
- 15 명 × 4 시나리오 fixture (critical 14/15, primary 12/15, non-primary 8/15, severe-unmitigated edge, empty edge, passing edge)
- 동일 입력 → 동일 출력 (`assert.deepEqual(repeat, result)`)

### 8.2 추적성 매트릭스 등재

`src/lib/vnv/traceability.ts` 39행 → **40행** 으로 확장.

```
{ requirementId: "SR-USABILITY-017",
  moduleName: "src/lib/usability/useScenarioValidator.ts",
  functionName: "normalizeScenarios / buildTaskCompletionStats / bucketUseErrors / buildHazardCoverage / evaluateSummativeUsability",
  testCaseId: "TC-USABILITY-001" }
```

IEC 62304 별지 제2호 export (`/api/therapist/system/iec62304-traceability?format=md`) 는 자동으로 본 추적 행을 포함한다.

## 9. IRB / 윤리 / 동의

### 9.1 동의 항목

- 평가 목적과 절차
- 영상·음성 녹화 여부 및 보관 기간
- 데이터 익명화 처리 (`maskPhi` / `maskPhiObject` 적용)
- 참여 중단 권리 (언제든지 사유 설명 없이 중단 가능)
- 동의 철회 시 데이터 즉시 폐기 절차
- 보상 (있을 경우) 명시

### 9.2 PHI 처리

- 참여자 식별정보는 별도 lookup 테이블로 분리, 평가 데이터셋 (`observations-v1.json`) 에는 가명 ID 만 기록
- 영상 녹화는 평가 종료 + 보고서 확정 후 6개월 이내 폐기. 기간 명시 필요
- 보고서 인용 시 `maskPhi` 적용 (이름·전화·RRN·이메일·환자ID 자동 마스킹)

## 10. 갱신 트리거

본 프로토콜은 다음 사건이 발생하면 갱신한다.

- 사용목적, 대상 환자, 출력 정보 변경 (POF / critical task 재산정 트리거)
- 위험관리 파일 (`risk-management-file.md`) RM-* 추가/변경 → HRUS §4.3 재매핑
- summative 평가 결과 합격기준 미달 → re-summative 후 §5 항목 갱신
- IEC 62366-1 또는 식약처 가이드라인 개정
- 식약처 사전상담 또는 시험기관 답변 수령
- 신규 critical task 식별 (formative 추가 round 결과)

## 11. 다음 산출물

- `data/usability/scenarios.json` v0.1 — §4.2 12 시나리오 직렬화
- `data/usability/observations-template.json` — §7.2 양식 템플릿
- `docs/regulatory/usability-evaluation-irb-package.md` — IRB 제출 부속자료
- `docs/regulatory/usability-evaluation-report-v1.0.md` — formative + summative 결과 (평가 후 작성)

## 12. 갱신 이력

- 2026-04-30 v0.1: 초안. IEC 62366-1 §5.4~5.9 절차 정의, POF 12종 + critical 2종 식별, use scenario 12종 + HRUS 매핑 (12 RM-*), formative 5/5/5~8 + summative 15 (U1 8 + U2 4 + U3 3) 설계, DEFAULT_SUMMATIVE_CRITERIA (critical=1.0 / primary=0.8 / severe unmitigated=0) 결정성 합격기준, SR-USABILITY-017 + TC-USABILITY-001 결정성 V&V 매핑.
