# BrainFriends GOLDEN

React/Next.js 기반의 음성·안면 멀티모달 분석 언어재활 소프트웨어입니다.
이 저장소는 향후 한국 식품의약품안전처(MFDS) SaMD 허가 준비를 고려한 구조로 개발됩니다.

## Always Remember

이 저장소에서 작업할 때는 아래 문장을 항상 기준으로 삼습니다.

- 이 프로젝트는 자동 진단 소프트웨어가 아니다.
- 이 프로젝트는 치료사 판단 보조용 정량 분석 소프트웨어다.
- 새 기능 추가보다 설명 가능성, 추적 가능성, 검증 가능성이 우선이다.
- 임상적 의미가 있는 결과는 반드시 버전, 입력, 실패조건, 저장 구조와 함께 다뤄야 한다.
- demo/mock 편의 기능이 실제 임상 경로를 오염시키지 않도록 분리해야 한다.

## Current Direction

현재 프로젝트는 아래 방향으로 전환 중입니다.

- 브라우저 임시 저장 중심 구조에서 서버/DB 기반 임상 저장 구조로 이동
- 페이지 단위 구현에서 분석 모듈, 저장 모듈, 감사로그 모듈 분리
- UI 중심 개발에서 허가 준비형 구조 중심 개발로 전환
- 결과 화면 중심 기능 추가에서 재현 가능한 분석 파이프라인 정리로 우선순위 이동
- 단일 점수 표시에서 version snapshot, traceability, safety check 포함 구조로 확장

현재 개발의 핵심 목표:
- SaMD 핵심 경로 식별
- 규제상 취약한 구조 제거
- 알고리즘/결과/저장/로그를 문서 가능한 형태로 고정

## What To Do Now

당장 우선해서 진행해야 할 작업:

1. SaMD 핵심 경로와 비핵심 UI를 코드상 분리
2. 환자/세션/결과 저장을 서버 DB 기준으로 통합
3. audit log 스키마와 저장 위치 정의
4. PII/PHI 분리 저장 구조 도입
5. 실패 모드별 중단 조건, fallback, 사용자 메시지 정리
6. fixture 기반 deterministic test 추가
7. 결과/로그/API/DB가 동일 version snapshot을 공유하도록 확장

현재 완료된 항목:
- step1~6, Brain Karaoke 결과 저장 시 공통 version snapshot 기록
- sing-training 결과에 governance + version snapshot 동시 기록

현재 가장 먼저 손대야 하는 파일 범주:
- `src/lib/analysis/*`
- `src/lib/speech/*`
- `src/lib/kwab/SessionManager.ts`
- `src/lib/patientStorage.ts`
- `src/app/(training)/programs/step-2/page.tsx`
- `src/app/(training)/programs/step-4/page.tsx`
- `src/app/(training)/programs/step-5/page.tsx`
- `src/app/(training)/programs/step-6/page.tsx`
- `src/app/(training)/programs/sing-training/page.tsx`
- `src/app/api/*`

## Do Not Forget During Implementation

구현 중 아래 항목이 빠지면 허가 준비 방향에서 벗어난 것으로 간주합니다.

- requirement id를 연결했는가?
- 입력 데이터 종류를 설명할 수 있는가?
- 출력값 정의가 고정되어 있는가?
- 실패 조건과 예외 처리가 명시되어 있는가?
- algorithm/scoring/model version이 저장되는가?
- 환자 식별자와 임상 데이터가 분리되는가?
- 감사로그가 남는가?
- 동일 입력에 대해 재현 가능한가?
- 테스트 또는 fixture가 추가되었는가?

## Do Not Merge Unless

아래 조건을 만족하지 못하면 핵심 분석 경로 변경을 병합하지 않는 것을 원칙으로 합니다.

- 분석 결과가 어떤 버전으로 계산됐는지 설명 가능할 것
- 저장 데이터 구조가 변경되면 영향 범위를 설명할 것
- 실패 시 사용자 메시지와 로그가 함께 정의될 것
- demo/mock 경로와 clinical 경로가 구분될 것
- 테스트 또는 수동 검증 절차가 제시될 것
- README 또는 관련 문서가 필요한 수준으로 업데이트될 것

## SaMD Positioning

이 프로젝트의 목표는 자동 진단 소프트웨어가 아니라, 치료사 판단을 보조하는 정량 분석 소프트웨어입니다.

Intended use:
- 환자의 음성 수행과 안면 반응을 정량적으로 수집·분석합니다.
- 언어재활 훈련 과정에서 치료사에게 참고 가능한 점수와 구조화된 결과를 제공합니다.
- 환자의 세션별 변화와 추세를 비교할 수 있도록 결과를 저장하고 조회합니다.

Not intended use:
- 단독 진단 또는 단독 치료 결정
- 의료진 검토 없이 자동으로 환자 상태를 확정하는 행위
- 응급 판단 또는 실시간 생명유지 의사결정

## SaMD In-Scope

다음 기능은 SaMD 범위에 포함되는 핵심 경로로 간주합니다.

- 환자 입력 정보 수집
- 음성 입력 수집 및 STT 기반 발화 분석
- 안면 랜드마크 추적 및 대칭/구강 움직임 feature extraction
- articulation feature extraction
- step별 점수 산출 및 종합 결과 계산
- 결과 리포트 및 치료사 확인용 정량 지표 표시
- 세션 저장, 이력 조회, 환자별 추세 비교
- 알고리즘 버전, scoring rule, feature schema 기록
- 감사로그, 실패 로그, 저장 무결성 관리

## SaMD Out-of-Scope

다음 기능은 기본적으로 비의료 기능 또는 운영 보조 기능으로 간주합니다.

- 일반 네비게이션 UI
- 카드 디자인, 애니메이션, 레이아웃 스타일링
- 로고, 브랜딩, 시각 효과
- 개발용 demo/skip/mock 데이터 생성 기능
- 일반적인 페이지 이동 및 운영 편의 기능

단, 위 기능이 환자 안전 또는 치료사 판단 흐름에 직접 영향을 주는 경우에는 사용적합성/위험관리 문서 범위에 포함될 수 있습니다.

## Core Regulatory Engineering Principles

이 프로젝트의 모든 구현과 리팩터링은 아래 원칙을 우선합니다.

1. 요구사항 추적 가능성
2. 알고리즘 버전 고정 및 변경관리
3. 입력/출력/실패조건의 명확한 정의
4. 검증(Verification) 및 타당성확인(Validation) 가능한 구조
5. 감사로그 및 데이터 무결성 확보
6. 개인정보(PII)와 의료정보(PHI)의 분리 저장
7. 사용적합성 및 사이버보안 자료로 연결 가능한 구조

## Current Functional Scope

현재 핵심 기능:
- Self-Assessment
- Speech Rehabilitation step 1~6
- Brain Karaoke
- 결과 리포트 및 이력 조회

현재 핵심 분석 요소:
- 음성 녹음 및 STT
- 안면 랜드마크 추적
- 발화/조음 관련 feature extraction
- reading/fluency/repetition/writing consistency scoring
- 세션 저장 및 결과 표시

## Architecture Direction

권장 논리 구조:
- Capture Layer: 카메라/마이크 입력 수집
- Feature Layer: landmark/audio 기반 feature extraction
- Scoring Layer: step별 점수 산출 및 종합 점수 계산
- Result Layer: 치료사용 결과 화면 및 추세 리포트
- Persistence Layer: DB 저장, 버전 기록, 감사로그
- Security Layer: PII/PHI 분리, 권한 관리, 암호화 정책

## Data Handling Policy

현재 개발 원칙:
- 직접 식별자와 분석 결과는 분리 가능한 구조로 이동한다.
- patient pseudonym id를 도입한다.
- 결과 저장 시 version snapshot을 함께 기록한다.
- demo/mock 데이터는 실제 임상 데이터와 명확히 구분한다.
- 브라우저 저장소 의존 구조는 서버 저장 구조로 단계적으로 대체한다.

필수 버전 필드:
- algorithm_version
- feature_schema_version
- scoring_rule_version
- model_version
- release_version

현재 공통 version snapshot 적용 범위:
- Self-Assessment step1~6
- Speech Rehabilitation step1~6 저장 경로
- Brain Karaoke result/session 경로

브라우저에서 version snapshot 수동 확인 방법:
- step1: `JSON.parse(localStorage.getItem("kwab_training_session"))?.step1?.versionSnapshot`
- step2: `JSON.parse(localStorage.getItem("kwab_training_session"))?.step2?.versionSnapshot`
- step3: `JSON.parse(localStorage.getItem("kwab_training_session"))?.step3?.versionSnapshot`
- step4: `JSON.parse(localStorage.getItem("kwab_training_session"))?.step4?.versionSnapshot`
- step5: `JSON.parse(localStorage.getItem("kwab_training_session"))?.step5?.versionSnapshot`
- step6: `JSON.parse(localStorage.getItem("kwab_training_session"))?.step6?.versionSnapshot`
- sing: `JSON.parse(sessionStorage.getItem("brain-sing-result"))?.versionSnapshot`

수동 검증 시 최소 확인할 필드:
- `pipeline_stage`
- `algorithm_version`
- `feature_schema_version`
- `scoring_rule_version`
- `model_version`
- `release_version`

## Verification and Validation Policy

향후 모든 핵심 분석 로직은 아래 검증이 가능해야 합니다.

- unit test 가능
- deterministic scoring test 가능
- fixture 기반 regression test 가능
- browser/device 차이 검증 가능
- threshold 변경 영향 검증 가능
- 실패 모드별 방어 로직 검증 가능

## Known Regulatory Gaps

현재 우선 보완 대상:
- UI와 분석 로직 결합
- localStorage/sessionStorage 중심 결과 저장
- 공통 버전 체계 부족
- 감사로그 미흡
- PII/PHI 분리 미완료
- 실패 모드 구조화 부족
- fixture 기반 회귀 테스트 부족

## Development Rules

새 기능 추가보다 아래를 우선합니다.

- 허가 심사 시 설명 가능한 구조일 것
- 변경 시 버전 기록과 영향 범위를 설명할 수 있을 것
- 실패 시 환자 안전 영향을 정의할 수 있을 것
- 결과 저장 항목과 로그 항목이 명확할 것
- 테스트 코드 또는 검증 절차로 연결될 수 있을 것

## Environment

권장 개발 환경:
- Node.js LTS
- Next.js 16
- PostgreSQL 17.x

환경 변수 예시는 [.env.example](/c:/Users/pc/Desktop/ProjectFiles/BrainFriends/golden/.env.example)에 있습니다.

## Database Direction

권장 DB 방향:
- PostgreSQL 기반 임상 결과 저장
- PII/PHI 분리 저장
- pseudonym mapping table 분리
- audit log append-only 저장
- 결과 저장 시 버전 동시 기록

초기 스키마 예시는 [brainfriends_dev.sql](/c:/Users/pc/Desktop/ProjectFiles/BrainFriends/golden/docs/database/brainfriends_dev.sql)에 있습니다.

## Database Table Summary

| Table | One-Line Meaning |
| --- | --- |
| `patient_pii` | 환자 이름, 생년월일, 전화번호 등 직접식별정보를 저장하는 PII 테이블 |
| `patient_pseudonym_map` | 직접식별자와 임상 데이터 사이를 연결하는 가명 매핑 테이블 |
| `clinical_sessions` | 어떤 훈련을 어떤 버전으로 언제 수행했는지 저장하는 세션 테이블 |
| `language_training_results` | self-assessment / speech-rehab의 AQ, step 점수, 상세 결과를 저장하는 임상 결과 테이블 |
| `sing_results` | Brain Karaoke 점수, jitter, facial symmetry, latency를 저장하는 임상 결과 테이블 |
| `audit_logs` | 저장 성공/실패/스킵과 입력 메타데이터, 버전, 점수를 남기는 감사로그 테이블 |

## Media Storage Note

현재 step 단계의 녹음/이미지 데이터는 아래처럼 저장됩니다.

- `step2`, `step4`, `step5`의 녹음 `audioUrl`은 브라우저 localStorage 기반 임시 데이터/히스토리 표시용으로만 사용됩니다.
- `step6`의 필기 이미지 `userImage`도 브라우저 localStorage 기반 임시 데이터/히스토리 표시용으로만 사용됩니다.
- 서버 DB의 `language_training_results.step_details` 저장 시에는 `audioUrl`, `userImage`, `cameraFrameImage`, `cameraFrameFrames`, `imageData`를 제거한 뒤 저장합니다.
- 즉 현재 DB에는 step 녹음 원본/필기 원본이 직접 저장되지 않고, 정량 결과와 구조화된 상세 값만 저장됩니다.
- Brain Karaoke의 `reviewAudioUrl`도 현재는 결과 화면 재생과 audit metadata 용도로만 쓰이며, PostgreSQL 테이블에는 직접 저장하지 않습니다.

이 원칙은 개인정보 최소화와 저장 용량/무결성 관점에서 의도된 설계입니다. 원본 멀티미디어를 장기 보존하려면 별도 object storage, 보존정책, 접근권한, 암호화 정책을 따로 설계해야 합니다.

## Repository Usage Note

이 저장소에서 구현 또는 리뷰를 진행할 때는 항상 아래 질문을 먼저 확인합니다.

- 이 기능이 SaMD 포함 범위인가?
- 입력/출력/실패조건이 정의되어 있는가?
- 알고리즘/모델/점수 규칙 버전이 기록되는가?
- 결과 재현성과 추적성이 확보되는가?
- 개인정보와 의료정보가 분리되는가?
- 검증 가능한 단위로 분리되어 있는가?

## Next Refactoring Priorities

1. SaMD 핵심 경로와 비핵심 UI의 코드상 분리
2. 서버 저장 및 감사로그 구조 정착
3. PII/PHI 분리 저장
4. 실패 모드 방어 로직 도입
5. fixture 기반 V&V 체계 구축
6. API/DB/audit log 전 구간에 version snapshot 고정

## Disclaimer

이 소프트웨어는 현재 허가 준비를 고려한 개발 단계의 시스템입니다.
의료적 판단과 최종 임상 결정은 반드시 자격을 갖춘 전문가의 책임 하에 이루어져야 합니다.


