# 사이버보안 저장 현황

## 목적

브라우저에 남는 민감 데이터를 줄이고, 가능한 한 원시 훈련 payload를 브라우저 장기 저장에서 제외하는 것이 목적입니다.

## 현재 정책 기준

정책 기준 파일:

- `src/lib/security/storagePolicy.ts`
- `src/lib/security/secureStorage.ts`
- `src/lib/security/transientStepStorage.ts`

## 브라우저 저장 현황

### 고위험 step payload

아래 step payload 키는 직접적인 persistent local storage 대신 transient session storage를 사용합니다.

| 키 | 상태 | 주요 위치 |
| --- | --- | --- |
| `step1_data` | transient session storage | `src/app/(training)/programs/step-1/page.tsx` |
| `step2_recorded_audios` | transient session storage | `src/app/(training)/programs/step-2/page.tsx` |
| `step3_data` | transient session storage | `src/app/(training)/programs/step-3/page.tsx` |
| `step4_recorded_audios` | transient session storage | `src/app/(training)/programs/step-4/page.tsx` |
| `step5_recorded_data` | transient session storage | `src/app/(training)/programs/step-5/page.tsx` |
| `step6_recorded_data` | transient session storage | `src/app/(training)/programs/step-6/page.tsx` |

### 현재 허용 중인 저위험 저장 영역

| 저장 영역 | 이유 |
| --- | --- |
| `kwab_training_session:*` | compact session resume 상태 |
| training exit progress (`sessionStorage`) | step resume 메타데이터 |
| camera/audio preference keys | 장치 편의 설정 |
| game mode progress | 비임상 진행 메타데이터 |

### 최종 정책 결정

| 항목 | 최종 결정 | 메모 |
| --- | --- | --- |
| `kwab_training_session:*` | 조건부 허용 | compact summary만 허용, 원시 미디어 제외 |
| exit progress | 허용 | `sessionStorage`만 사용 |
| legacy local fallback read | 전환기 허용 | 읽기 전용 호환 경로, 추후 제거 |
| therapist notes | 현재 단계 허용 | 서버 파일 기반 운영 저장 |

## 브라우저 쓰기 차단

제한되거나 차단된 브라우저 쓰기 시도는 아래를 통해 기록됩니다.

- `src/app/api/security-audit/route.ts`
- `src/lib/server/securityAuditDb.ts`

치료사 확인 화면:

- `/therapist/system`

## compact 경로에서 제거되는 민감 필드

compact history 정리 시 아래 필드는 제거됩니다.

- `audioUrl`
- `userImage`
- `cameraFrameImage`
- `cameraFrameFrames`
- `imageData`

참고 코드:

- `src/lib/vnv/deterministicChecks.ts`
- `src/lib/vnv/runDeterministicChecks.ts` (`TC-STORAGE-001`)

## 남은 후속 작업

1. 브라우저 마이그레이션이 완료되면 legacy local fallback read 제거
2. 운영 고도화 시 therapist note DB 이전 재검토
3. resume 범위가 넓어질 경우 compact session 저장 내용 재점검
