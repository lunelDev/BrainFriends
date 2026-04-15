# 사이버보안 최종 고정 보고서

## 목적

이 문서는 현재 remediation 범위에서 사이버보안 항목을 최종 고정된 정책과 남은 후속 과제로 정리한 운영본입니다.

## 현재 최종 판단

- 고위험 원시 step 데이터의 브라우저 장기 저장: **정리 완료**
- compact session summary 저장: **조건부 허용**
- 종료 진행 메타데이터: **sessionStorage 범위로 허용**
- legacy local fallback read: **전환기 read-only 경로로 한시 허용**
- therapist note 저장: **현재 단계에서 서버 파일 기반 운영 저장으로 허용**

## 코드 기준 고정 상태

### 브라우저 저장 통제

- `src/lib/security/storagePolicy.ts`
- `src/lib/security/secureStorage.ts`
- `src/lib/security/transientStepStorage.ts`

### 고위험 step 원시 payload 처리

- `src/app/(training)/programs/step-1/page.tsx`
- `src/app/(training)/programs/step-2/page.tsx`
- `src/app/(training)/programs/step-3/page.tsx`
- `src/app/(training)/programs/step-4/page.tsx`
- `src/app/(training)/programs/step-5/page.tsx`
- `src/app/(training)/programs/step-6/page.tsx`

### 운영 메타데이터 및 종료 진행

- `src/lib/trainingStorage.ts`
- `src/lib/trainingResume.ts`
- `src/lib/trainingExitProgress.ts`
- `src/features/result/utils/resultHelpers.ts`

### 보안 이벤트 기록

- `src/app/api/security-audit/route.ts`
- `src/lib/server/securityAuditDb.ts`

## 현재 허용 범위

| 항목 | 허용 여부 | 조건 |
| --- | --- | --- |
| `kwab_training_session:*` | 허용 | compact summary only, 원시 미디어 필드 금지 |
| `kwab_training_exit_progress` | 허용 | `sessionStorage` only |
| camera/audio preference | 허용 | 장치 편의 설정만 저장 |
| game mode progress | 허용 | 비임상 진행 메타데이터만 저장 |
| therapist note | 허용 | 브라우저 로컬 저장 금지, 서버 운영 저장만 허용 |

## 검증 기준

- `TC-STORAGE-001`: compact history에서 raw media field 제거 여부 검증
- 치료사 시스템 화면: `/therapist/system`
- 보안 이벤트 API: `/api/security-audit`

## 남은 후속 과제

1. 마이그레이션 종료 후 legacy local fallback read 제거
2. 운영 고도화 단계에서 therapist note의 DB 전환 여부 결정
3. resume 범위가 확대될 경우 compact session 저장 필드 재검토

## 최종 결론

현재 remediation 범위에서 사이버보안 항목은 **정책 고정 및 코드 반영이 완료된 상태**로 보며, 남은 작업은 운영 고도화 성격의 후속 과제로 분류합니다.
