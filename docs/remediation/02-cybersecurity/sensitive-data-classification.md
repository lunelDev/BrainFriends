# 민감정보 분류표

## 목적

이 문서는 BrainFriends의 주요 데이터 항목을 제출 및 사이버보안 검토 기준으로 분류한 표입니다.

## 분류표

| 데이터 항목 | 예시 | 분류 | 민감도 | 현재 처리 방식 |
| --- | --- | --- | --- | --- |
| 사용자 식별값 | `patientId`, pseudonym id | 식별자 | 높음 | 가능하면 가명화, 서버 우선 저장 |
| 사용자 이름 | 실명 | 개인정보 | 높음 | 서버 1차 저장 |
| 생년월일 | `YYYY-MM-DD` | 개인정보 / 건강 문맥 보조 정보 | 높음 | 서버 1차 저장 |
| 연락처 | 전화번호 | 개인정보 | 높음 | 서버 1차 저장 |
| 로그인 ID | `login_id` | 계정 식별자 | 높음 | 서버 1차 저장 |
| AQ 점수 | `82.4` | 임상 결과 | 중간 | 서버 1차 저장, compact 요약 허용 |
| step 점수 | `step1~6` 요약 점수 | 임상 결과 | 중간 | 서버 1차 저장, compact 요약 허용 |
| 측정 품질 | `measured / partial / demo` | 품질 메타데이터 | 중간 | 서버 저장 및 compact 요약 허용 |
| transcript | 발화 결과 텍스트 | 음성 기반 임상 데이터 | 높음 | 서버 1차 저장, 브라우저는 transient만 허용 |
| audio blob / audio URL | 녹음 파일 | 미디어 / 생체 인접 정보 | 높음 | 서버 우선 저장, 브라우저 장기 raw 저장 금지 |
| face key frame / user image | `data:image/...` | 이미지 / 생체 인접 정보 | 높음 | 서버 우선 저장, compact 저장에서 제거 |
| landmark / tracking metric | fps, trackingQuality, symmetry | 모델 / 측정 데이터 | 중간 | 서버 저장 및 평가 구조에 포함 |
| V&V metadata | requirementIds, testCaseIds, runtimeChecks | 검증 증적 | 중간 | 결과 메타데이터와 함께 저장 |
| security audit event | blocked storage write | 운영 보안 데이터 | 중간 | 서버 감사 경로 저장 |
| therapist memo | follow-up, note text | 임상 업무 메모 | 중간 | 현재 서버 파일 저장 |
| device preference | camera/audio device id | 장치 선호 설정 | 낮음 | 브라우저 편의 저장 |

## 분류 기준

### 높음

- 직접 식별 가능한 정보
- 원시 미디어
- transcript, 이미지 payload
- 사용자 재식별 또는 임상 노출 위험이 큰 데이터

### 중간

- 파생 임상 점수
- runtime evidence
- 품질 분류
- 치료사 업무 메타데이터

### 낮음

- 단순 편의 설정
- 원시 payload가 없는 비민감 진행 메타데이터

## 정책 방향

1. 고위험 데이터는 가능한 한 서버 우선 저장
2. 브라우저 저장은 transient 또는 compact 형태로 제한
3. raw media field는 compact cache 경로에 남지 않도록 유지
4. 제출 문서에서는 식별정보, 임상정보, 모델정보, 운영정보를 명확히 구분
