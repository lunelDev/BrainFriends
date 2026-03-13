# PII / PHI Separation Draft

이 문서는 BrainFriends GOLDEN의 개인정보(PII) / 의료정보(PHI) 분리 저장 초안입니다.
현재 구현 기준은 `sing-training`과 `step1~6 self/rehab 결과 저장` 경로를 포함합니다.

## 1. 데이터 분리 아키텍처

분리 원칙:
- 직접 식별자(이름, 생년월일, 전화번호)는 `patient_pii`에만 저장
- 분석/세션/점수 데이터는 `patient_pseudonym_id` 기준으로 저장
- 앱/치료사 화면의 대부분 조회는 pseudonym 기반 clinical table에서 수행
- 실명 확인이 꼭 필요한 경우에만 mapping table을 통해 제한적으로 접근

권장 논리 구조:
- `patient_pii`
  - 직접 식별자 저장
- `patient_pseudonym_map`
  - `patient_id <-> patient_pseudonym_id` 매핑
- `clinical_sessions`
  - pseudonym 기준 세션 저장
- `language_training_results`
  - self-assessment / speech-rehab step1~6 결과 저장
- `sing_results`
  - pseudonym 기준 노래방 결과 저장
- `audit_logs`
  - pseudonym 기준 감사로그 저장

## 2. DB 스키마 제안

핵심 테이블:
- `patient_pii`
- `patient_pseudonym_map`
- `clinical_sessions`
- `language_training_results`
- `sing_results`
- `audit_logs`

현재 SQL 초안:
- [brainfriends_dev.sql](/c:/Users/pc/Desktop/ProjectFiles/BrainFriends/golden/docs/database/brainfriends_dev.sql)

## 3. API 권한 정책

기본 정책:
- 환자 생성/수정 API: therapist/admin만 PII 접근 허용
- 결과 저장 API: pseudonym 기반 clinical write만 수행
- 랭킹/리포트 API: 기본적으로 pseudonym 또는 masked display만 사용
- mapping table 조회 API: 최소 권한 + 감사로그 필수

권장 역할 예시:
- `patient`: 본인 결과 열람, 직접 식별자 최소 접근
- `therapist`: 담당 환자 clinical data 조회, 제한적 PII 조회
- `admin`: 운영 목적 최소 범위 접근
- `system`: background ingest / audit

## 4. 코드 리팩터링안

현재 적용 초안:
- [singResultsDb.ts](/c:/Users/pc/Desktop/ProjectFiles/BrainFriends/golden/src/lib/server/singResultsDb.ts)
  - `patient_pii`, `patient_pseudonym_map`, `clinical_sessions`, `sing_results` 순서로 저장
- [clinicalResultsDb.ts](/c:/Users/pc/Desktop/ProjectFiles/BrainFriends/golden/src/lib/server/clinicalResultsDb.ts)
  - `patient_pii`, `patient_pseudonym_map`, `clinical_sessions`, `language_training_results` 순서로 저장
- [auditLog.ts](/c:/Users/pc/Desktop/ProjectFiles/BrainFriends/golden/src/lib/server/auditLog.ts)
  - `patient_pseudonym_id` 기준 감사로그 기록

다음 확장 대상:
- `patientStorage`를 직접 DB write하지 않고 server action/API 경유
- ranking/query 계층에서 실명 제거, masked display 기본화
- therapist/admin 권한별 API gate 추가

## 5. 보안 검토 체크리스트

- 직접 식별자는 clinical query 결과에 기본 포함되지 않는가?
- pseudonym mapping table 접근이 role 제한을 받는가?
- audit log에 실명이 남지 않는가?
- 전송 구간 TLS를 전제로 하는가?
- 저장 구간 암호화(at rest) 구성을 운영 인프라에서 강제하는가?
- DB 백업에도 PII/clinical 분리 정책이 반영되는가?
- 개발/테스트 환경에서 실데이터 사용을 막는가?
