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

1. 로그인 사용자 기준 `최초 진단 여부`를 DB 조회로 판단
2. 환자/세션/결과 조회를 localStorage가 아니라 서버 DB 기준으로 통합
3. 결과 페이지와 리포트 페이지를 PostgreSQL 조회 우선 구조로 전환
4. PII/PHI 분리 저장 구조와 파일 기반 audit log 운영 범위를 확정
5. 실패 모드별 중단 조건, fallback, 사용자 메시지를 정리
6. fixture 기반 deterministic test를 추가
7. 결과/로그/API/DB가 동일 version snapshot을 공유하도록 확장

현재 완료된 항목:
- step1~6, Brain Karaoke 결과 저장 시 공통 version snapshot 기록
- sing-training 결과에 governance + version snapshot 동시 기록
- 회원가입 / 로그인 / 아이디 찾기 / 비밀번호 재설정 기본 경로 추가
- NCP Object Storage 기반 미디어 업로드 경로 추가

현재 가장 먼저 손대야 하는 파일 범주:
- `src/lib/kwab/SessionManager.ts`
- `src/lib/patientStorage.ts`
- `src/app/page.tsx`
- `src/app/(training)/report/page.tsx`
- `src/app/(result)/*`
- `src/app/api/*`
- `src/lib/server/*`

## Deployment Checklist

배포 시작 기준:

- `npm run build` 성공
- 환경변수 연결 완료
- PostgreSQL / NCP Object Storage 실제 연결 확인
- 회원가입부터 관리자 조회까지 한 바퀴 검증 완료

### 1. PostgreSQL 준비

- NCP Cloud DB for PostgreSQL 생성
- DB 이름 생성
- 앱 전용 계정 생성
- 앱 서버 IP만 접속 허용
- `docs/database/brainfriends_dev.sql` 반영

### 2. Object Storage 준비

- 버킷 생성
- 액세스 키 / 시크릿 키 발급
- `endpoint`, `region` 확인
- 업로드 권한 확인

### 3. 앱 서버 준비

- Node.js 설치
- 프로젝트 코드 배포
- `npm install`
- `npm run build` 성공 확인
- 프로세스 매니저 준비

### 4. 환경변수 설정

- `DATABASE_URL`
- `DATABASE_SSL`
- `NCP_OBJECT_STORAGE_ENDPOINT`
- `NCP_OBJECT_STORAGE_REGION`
- `NCP_OBJECT_STORAGE_BUCKET`
- `NCP_ACCESS_KEY`
- `NCP_SECRET_KEY`
- 기타 기존 STT / OpenAI 관련 키

### 5. 보안 설정

- DB 외부 전체 공개 금지
- 앱 서버만 DB 접근 허용
- HTTPS 적용
- `.env` 파일 외부 노출 방지

### 6. 관리자 계정 확인

- 관리자 계정 1개 생성
- `user_role='admin'` 확인
- 관리자 메뉴 접근 확인

### 7. 실제 기능 테스트

- 환자 회원가입
- 관리자 회원가입
- 로그인 / 로그아웃
- 최초 자가진단 시작
- step 진행
- 결과 저장
- step6 이미지 업로드
- step2 / step4 / step5 음성 업로드
- Brain Karaoke 녹음 업로드
- 관리자 리포트 확인
- 전체 환자 타임라인 확인

### 8. 멀티브라우저 테스트

- 브라우저 A에서 로그인 후 일부 진행
- 브라우저 B에서 같은 계정 로그인
- draft / 결과 / 리포트가 이어지는지 확인

### 9. DB 저장 확인

실제 row 확인 대상:

- `app_users`
- `patient_pii`
- `patient_pseudonym_map`
- `clinical_sessions`
- `language_training_results`
- `sing_results`
- `training_client_drafts`
- `training_usage_events`
- `clinical_media_objects`

### 10. 백업 / 운영

- DB 백업 정책 확인
- Object Storage 보존 정책 확인
- 장애 시 복구 절차 메모

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

## Current Models and Technical Stack

현재 프로젝트에서 실제로 사용 중인 모델/기술 스택은 아래와 같다.

| Area | Technology / Model | Current Use |
| --- | --- | --- |
| Face landmark / facial asymmetry | MediaPipe Face Landmarker (`@mediapipe/tasks-vision`) | 자가진단, 언어재활, 노래방의 공통 얼굴 랜드마크 추적 및 대칭/구강 feature extraction |
| Speech-to-text | OpenAI `whisper-1` | 현재 사용 중인 음성 전사(STT) 경로. `NEXT_PUBLIC_DEV_MODE=true` 이면 테스트 응답을 반환할 수 있음 |
| OCR | `tesseract.js` | 이미지 텍스트 추출 관련 기능용 라이브러리 포함 |
| Browser ML runtime | WebAssembly + MediaPipe Tasks Vision | 브라우저 측 얼굴 분석 실행 환경 |
| Rule-based scoring | Project-local scoring logic | step별 점수, AQ, 노래방 점수, 임상 요약값 계산 |

기술적 주의사항:

- 얼굴 분석은 공통 `FaceTracker` / `LeftSidebar` 기반으로 연결되어 있으므로, 노래방만이 아니라 자가진단과 언어재활의 안정성과도 직접 연결된다.
- 외부 CDN 의존을 줄이기 위해 MediaPipe wasm/model asset은 `public/mediapipe` 경로에 로컬 고정한다.
- 결과 저장 시 `algorithm_version`, `feature_schema_version`, `scoring_rule_version`, `model_version`, `release_version`을 같이 기록해 재현성과 추적성을 확보한다.
- 점수는 모델 출력 그 자체가 아니라 landmark/STT 결과를 입력으로 하는 규칙 기반 후처리를 포함한다.

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

현재 관리자 화면의 리포트 검증 KPI는 정식 임상 검증값이 아니라 내부 추정 참고치입니다.
- `분석 정확도(추정)`: 문항 점수, 발음 점수, transcript 유사도 등 앱 내부 채점값 평균
- `임상적 상관성(추정)`: AQ/step 점수와 내부 proxy clinical score 간 상관계수
- `반복측정 신뢰도 ICC(추정)`: 동일 표본에서 앱 점수와 proxy score 간 ICC 추정치

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

환경 변수 예시는 [.env.example](./.env.example)에 있습니다.

## Database Direction

권장 DB 방향:
- PostgreSQL 기반 임상 결과 저장
- PII/PHI 분리 저장
- pseudonym mapping table 분리
- audit log append-only 파일 저장
- 결과 저장 시 버전 동시 기록

초기 스키마 예시는 [brainfriends_dev.sql](./docs/database/brainfriends_dev.sql)에 있습니다.

## Database Table Summary

| Table | One-Line Meaning |
| --- | --- |
| `app_users` | 로그인 계정, 권한, 비밀번호 해시를 저장하는 애플리케이션 사용자 테이블 |
| `patient_pii` | 환자 이름, 생년월일, 전화번호 등 직접식별정보를 저장하는 PII 테이블 |
| `patient_intake_profiles` | 학력, 발병일, 편마비, 반맹 등 초기 문진 정보를 저장하는 환자 프로필 테이블 |
| `patient_pseudonym_map` | 직접식별자와 임상 데이터 사이를 연결하는 가명 매핑 테이블 |
| `clinical_sessions` | 어떤 훈련을 어떤 버전으로 언제 수행했는지 저장하는 세션 테이블 |
| `language_training_results` | self-assessment / speech-rehab의 AQ, step 점수, 상세 결과, 측정 품질(`measurement_quality`)을 저장하는 임상 결과 테이블 |
| `clinical_media_objects` | object storage에 업로드한 녹음/이미지/영상의 버킷, object key, 메타데이터를 저장하는 미디어 테이블 |
| `sing_results` | Brain Karaoke의 자음 정확도, 모음 정확도, 가사 일치도, jitter, facial symmetry, latency, 인식 가사를 저장하는 임상 결과 테이블 |
| `training_usage_events` | 화면 진입, 결과 저장, draft sync 등 사용자 동작 이력을 append-only로 남기는 이벤트 로그 테이블 |

## Media Storage Note

현재 step 단계의 녹음/이미지 데이터는 아래처럼 저장됩니다.

- `step2`, `step4`, `step5`의 녹음 `audioUrl`은 훈련 중에는 브라우저 localStorage 기반 임시 데이터로 유지되고, 결과 화면에서 최종 결과 저장 시점에만 object storage 업로드를 시도합니다.
- `step6`의 필기 이미지 `userImage`도 훈련 중에는 브라우저 localStorage 기반 임시 데이터로 유지되고, 결과 화면에서 최종 결과 저장 시점에만 object storage 업로드를 시도합니다.
- Brain Karaoke의 `reviewAudioUrl`도 노래 종료 직후 로컬 결과에만 유지되며, 결과 화면 저장 시점에만 서버 업로드를 시도합니다.
- 서버 DB의 `language_training_results.step_details` 저장 시에는 `audioUrl`, `userImage`, `cameraFrameImage`, `cameraFrameFrames`, `imageData`를 제거한 뒤 저장합니다.
- 즉 현재 DB에는 step 녹음 원본/필기 원본이 직접 저장되지 않고, 정량 결과와 구조화된 상세 값만 저장됩니다.
- 원본 미디어는 훈련 중간 단계에서 바로 업로드하지 않고, 결과가 확정되어 레포트에 반영되는 시점에만 업로드되도록 유지합니다.

이 원칙은 개인정보 최소화와 저장 용량/무결성 관점에서 의도된 설계입니다. 원본 멀티미디어를 장기 보존하려면 별도 object storage, 보존정책, 접근권한, 암호화 정책을 따로 설계해야 합니다.

## Data Retention and Traffic Policy

중간 저장 데이터와 운영 로그는 원장 데이터와 분리해서 관리해야 한다.

| Target | Risk | Operational Policy |
| --- | --- | --- |
| `training_client_drafts` | 높음 | 최종 결과 저장 후 관련 draft 삭제, 미완료 draft는 7~30일 보관 후 정리 |
| `training_usage_events` | 높음 | 핵심 이벤트만 저장, 30~90일 보관 후 archive 또는 월별 집계로 전환 |
| `clinical_media_objects` | 중간 | 메타데이터는 보관 가능하나 원본 object storage와 분리해서 보존 정책 적용 |
| Object Storage 원본 오디오/이미지/영상 | 매우 높음 | 임상 요구사항 기준으로 30~90일 또는 별도 장기보관 정책 적용 |
| `language_training_results.step_details` | 중간 | 원본/중복 데이터를 제외하고 구조화된 결과만 저장 유지 |
| `clinical_sessions` | 낮음 | 세션 원장 데이터로 기본 보관 |
| `language_training_results` | 낮음 | 임상 결과 원장 데이터로 기본 보관 |
| `sing_results` | 낮음 | 노래방 결과 원장 데이터로 기본 보관 |
| `app_users`, `patient_pii`, `patient_intake_profiles`, `patient_pseudonym_map` | 낮음 | 개인정보 및 환자 원장 데이터이므로 임의 삭제 금지 |
| audit log | 중간~높음 | 월별 rotation, 장기 archive, 장애 분석용 분리 보관 |

운영 원칙:

- DB row 수보다 미디어 업로드와 과도한 draft sync 요청이 더 큰 비용 요인이 될 수 있다.
- 결과 원장 데이터와 운영 로그/임시 저장 데이터는 동일한 보존 기준으로 관리하면 안 된다.
- object storage 원본은 임상 요구사항이 확정되지 않으면 무기한 저장하지 않는다.
- 운영 전에는 draft 정리 정책, event archive 정책, object storage 보존 정책을 함께 정의해야 한다.

## Repository Usage Note

이 저장소에서 구현 또는 리뷰를 진행할 때는 항상 아래 질문을 먼저 확인합니다.

- 이 기능이 SaMD 포함 범위인가?
- 입력/출력/실패조건이 정의되어 있는가?
- 알고리즘/모델/점수 규칙 버전이 기록되는가?
- 결과 재현성과 추적성이 확보되는가?
- 개인정보와 의료정보가 분리되는가?
- 검증 가능한 단위로 분리되어 있는가?

## Deployment Goal

현재 제품 목표는 아래 사용자 시나리오를 배포 환경에서 안정적으로 지원하는 것입니다.

- 사용자가 외부에서 사이트에 접속한다.
- 사용자가 회원가입 후 아이디/비밀번호로 로그인한다.
- 로그인한 사용자가 자기 훈련 결과와 이력을 다시 조회한다.
- 녹음/이미지 원본은 object storage에 저장되고, 결과/메타데이터는 PostgreSQL에 저장된다.
- 동일 사용자가 다른 브라우저나 다른 기기에서도 같은 계정으로 자기 데이터를 볼 수 있다.

이 목표를 만족하려면 브라우저 localStorage/sessionStorage 기반 상태가 아니라 서버/DB 기반 상태가 우선 source of truth가 되어야 한다.

현재 상태에서 배포만 먼저 하면 회원가입/로그인은 가능하지만, 사용자가 다른 브라우저나 다른 기기에서 자기 이력을 안정적으로 보는 요구사항은 완전히 충족되지 않는다.

## NCP Deployment Shape

권장 배포 구조는 아래와 같다.

- Next.js 서버: NCP Compute 또는 컨테이너 환경에 배포
- PostgreSQL: 회원정보, 세션, 결과, 이력 저장
- NCP Object Storage: step 녹음/step6 이미지/sing review audio 저장
- HTTPS 진입점: Load Balancer 또는 외부 도메인 연결

권장 데이터 흐름:

1. 브라우저가 배포된 Next.js 서버에 접속
2. 로그인/회원가입/결과 저장 요청을 서버 API가 처리
3. 서버가 PostgreSQL에 회원정보/결과/세션을 저장
4. 서버가 NCP Object Storage에 원본 미디어를 업로드
5. 결과 화면은 PostgreSQL 조회를 우선 사용

보안 원칙:

- 직접식별정보는 PostgreSQL에만 저장
- object storage 경로에는 `patient_pseudonym_id` 같은 가명 식별자만 사용
- 이름/생년월일/전화번호는 object key에 넣지 않는다
- object storage 접근은 signed URL 또는 서버 프록시 기반으로 제한한다

## External Report Data Requirements

외부 레포트 사이트에서 결과를 안정적으로 표시하려면 최소한 아래 데이터 항목을 조회할 수 있어야 한다.

| Report Area | Required Data |
| --- | --- |
| 환자 기본 정보 | `patient_code`, `full_name`, `birth_date`, `sex`, `education_years`, `onset_date`, `days_since_onset` |
| 계정/접속 정보 | `login_id`, `user_role`, `last_login_at`, `created_at` |
| 자가진단 세션 정보 | `clinical_sessions.training_type='self-assessment'`, `session_id`, `completed_at`, `algorithm_version`, `version_snapshot` |
| 언어재활 세션 정보 | `clinical_sessions.training_type='speech-rehab'`, `session_id`, `completed_at`, `algorithm_version`, `version_snapshot` |
| 자가진단/언어재활 요약 점수 | `aq`, `rehab_step`, `step_scores`, `source_history_id` |
| 자가진단/언어재활 상세 결과 | `step_details`, `articulation_scores`, `facial_analysis_snapshot`, `measurement_quality`, `step_version_snapshots` |
| 노래방 결과 | `clinical_sessions.training_type='sing-training'`, `song_key`, `score`, `consonant_accuracy`, `vowel_accuracy`, `lyric_accuracy`, `jitter`, `facial_symmetry`, `latency_ms`, `recognized_lyrics`, `comment`, `version_snapshot` |
| 미디어 메타데이터 | `clinical_media_objects.bucket_name`, `object_key`, `media_type`, `capture_role`, `mime_type`, `file_size_bytes`, `duration_ms`, `captured_at` |
| 사용 이력 | `training_usage_events.event_type`, `event_status`, `training_type`, `step_no`, `page_path`, `session_id`, `created_at` |

외부 사이트 레포트 구현 시 주의사항:

- 자가진단과 언어재활은 모두 `language_training_results`를 읽되 `clinical_sessions.training_type` 와 `training_mode`, `rehab_step` 으로 구분해야 한다.
- 노래방은 `sing_results`를 별도로 읽어야 한다.
- 원본 녹음/이미지 재생이 필요하면 `clinical_media_objects`와 object storage를 함께 연결해야 한다.
- `step_details`, `articulation_scores`, `facial_analysis_snapshot`는 JSON 구조를 그대로 해석할 수 있는 파서가 필요하다.

## Pending Work

앞으로 작업해야 할 항목:

- `brainfriends.goldenbraincare.com` DNS 반영 완료 여부 확인
- Nginx reverse proxy 설정 추가
- HTTPS 인증서 발급 및 443 적용
- HTTPS 환경에서 카메라/마이크 권한 정상 동작 확인
- 회원가입 -> 로그인 -> 훈련 진입 -> 결과 저장 전체 플로우 점검
- `clinical_media_objects` 실제 적재 여부와 object storage 업로드 정합성 확인
- 외부 레포트 사이트에서 사용할 조회 API 또는 SQL view 설계
- 자가진단 / 언어재활 / 노래방 결과를 외부 레포트 화면에서 공통 포맷으로 매핑하는 규칙 정의
- 노래방 결과 페이지 문구를 언어 발화 훈련 중심 해석으로 지속 정리
- 노래방의 자음/모음/가사 일치도와 보조 안면 지표에 대한 레포트 문구 기준 정리
- `step_details` JSON 구조를 외부 레포트에서 표시할 수 있도록 파서/스키마 문서화
- 원본 음성/이미지/영상이 레포트에 필요할 경우 object storage signed URL 정책 설계
- self-assessment / speech-rehab / sing 결과 조회를 DB 우선 구조로 정리
- `src/lib/patientStorage.ts` 의 로컬 의존을 줄이고 서버 세션/DB 조회 기준으로 정리
- 운영 점검용 SQL, 로그 확인 명령, 배포 절차를 문서화
- 배포 서버의 `.env` 중 민감정보 교체 계획 수립
- DB 비밀번호, `NCP_ACCESS_KEY`, `NCP_SECRET_KEY` 교체

## Disclaimer

이 소프트웨어는 현재 허가 준비를 고려한 개발 단계의 시스템입니다.
의료적 판단과 최종 임상 결정은 반드시 자격을 갖춘 전문가의 책임 하에 이루어져야 합니다.
