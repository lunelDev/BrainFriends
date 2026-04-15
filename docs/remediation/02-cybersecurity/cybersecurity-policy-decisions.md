# 사이버보안 정책 결정서

## 목적

이 문서는 remediation 범위에서 남아 있는 저위험 브라우저 저장과 운영 저장 항목에 대한 최종 정책 결정을 기록합니다.

## 최종 결정

### 1. Compact Training Session Cache

결정: **허용**

조건:
- 저장 내용은 compact summary state로 제한
- raw media field는 포함 금지
- step payload는 요약 상태만 유지
- 실행 검증은 `TC-STORAGE-001`로 계속 확인

이유:
- resume 및 이어하기 동작에 필요
- 현재 저장 내용은 AQ 관련 진행 상태와 step 요약 중심
- 고위험 원시 브라우저 저장은 이미 별도 경로로 분리됨

### 2. Training Exit Progress

결정: **`sessionStorage`에 한해 허용**

조건:
- `localStorage`에 장기 저장하지 않음
- `currentStep`, `completedThroughStep`, `updatedAt`만 유지
- 브라우저 세션 종료 시 자연스럽게 정리

이유:
- 종료 진행 상태는 임상 결과가 아니라 resume용 운영 메타데이터
- 장기 저장보다 세션 범위 저장이 적절

### 3. Legacy Local Fallback Read

결정: **전환기 read-only 경로로 한시 허용**

조건:
- 새 쓰기는 transient/session 또는 서버 저장을 우선 사용
- local fallback은 읽기 전용 호환 경로로만 유지
- 마이그레이션 및 현장 검증 완료 후 제거

이유:
- 기존 브라우저에 남아 있는 구버전 상태와의 호환성이 필요
- 읽기 전용 호환은 전환 중 장애를 줄여줌
- 영구 정책이 아니라 전환기 정책

### 4. Therapist Notes Storage

결정: **현재 단계에서 서버 파일 기반 운영 저장으로 허용**

조건:
- note는 서버에만 저장
- 브라우저 클라이언트는 therapist note를 별도 로컬 저장하지 않음
- 현재 remediation 마일스톤에서는 파일 저장을 허용
- DB 이전은 후속 운영 고도화 과제로 둠

이유:
- therapist note는 1차 임상 점수 데이터가 아니라 운영 메모 성격
- 현재 구현은 서버 저장 + 역할 제한 구조
- DB 이전은 장기적으로 좋지만, 현재 remediation 범위 마감의 필수 조건은 아님

## 현재 제출 관점 결론

현재 remediation 제출 범위에서는 아래와 같이 봅니다.

- compact session cache: **조건부 허용**
- exit progress: **세션 범위 저장으로 허용**
- legacy local fallback read: **전환기 경로로 허용**
- therapist notes: **서버 운영 저장으로 허용**

## remediation 이후 후속 작업

1. 마이그레이션 검증 후 legacy local fallback read 제거
2. 운영 고도화 단계에서 therapist note의 DB 이전 재검토
3. resume 범위가 확대될 경우 compact session 저장 내용을 다시 검토
