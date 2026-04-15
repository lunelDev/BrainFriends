# SW V&V 제출 개요

## 범위

현재 BrainFriends는 아래 핵심 요구사항을 실제 런타임 로직에서 다룹니다.

| 요구사항 ID | 제목 | 런타임 연결 위치 |
| --- | --- | --- |
| `SR-LOGIN-001` | 로그인 성공 후 사용자 세션 진입 | `src/app/page.tsx`, `src/lib/server/accountAuth.ts` |
| `SR-PERMISSION-002` | 카메라/마이크 권한 없으면 진입 차단 | `src/app/page.tsx` |
| `SR-SESSION-003` | Step 결과 저장 및 복원 | `src/lib/kwab/SessionManager.ts` |
| `SR-SCORE-004` | AQ 점수 자동 계산 | `src/lib/kwab/SessionManager.ts`, `src/lib/kwab/KWABScoring.ts` |
| `SR-HISTORY-005` | 결과 리포트 저장 및 재조회 | `src/lib/kwab/SessionManager.ts`, clinical results save path |
| `SR-MEASURE-006` | measured / partial / demo 구분 반영 | `src/lib/vnv/deterministicChecks.ts`, `SessionManager` |

## 추적성

추적성 매트릭스는 아래 파일에 정의되어 있습니다.

- `src/lib/vnv/traceability.ts`
- `src/lib/vnv/requirements.ts`

실행 시점 V&V 스냅샷은 아래 경로를 통해 결과 저장 흐름과 연결됩니다.

- `src/lib/kwab/SessionManager.ts`
- `src/lib/server/clinicalResultsDb.ts`
- `src/lib/server/auditLog.ts`

## 실행 가능한 증적

deterministic 검증 명령:

```bash
npm run test:vnv
npm run test:vnv:record
```

현재 deterministic check 목록:

| 시험 케이스 ID | 목적 |
| --- | --- |
| `TC-SCORE-001` | AQ 계산 고정 검증 |
| `TC-MQ-001` | 측정 품질 분류 검증 |
| `TC-HIST-001` | history 저장 병합 검증 |
| `TC-LOGIN-THERAPIST-001` | 역할 기반 치료사 라우팅 검증 |
| `TC-STORAGE-001` | compact history의 원시 미디어 제거 검증 |
| `TC-PERM-001` | 권한 거부 차단 검증 |
| `TC-PERM-CANCEL-001` | 권한 요청 중간 취소 처리 검증 |
| `TC-SAVE-FAIL-001` | 저장 실패 fallback 검증 |
| `TC-SAVE-RETRY-001` | 서버 저장 실패 후 재시도 상태 검증 |
| `TC-SESS-RESTORE-001` | 세션 복원 검증 |
| `TC-STEP-FALLBACK-001` | step fallback 우선순위 검증 |
| `TC-RESULT-REFETCH-001` | 결과 재조회 불일치 시 server-first 선택 검증 |

핵심 검증 유틸:

- `src/lib/vnv/testRunner.ts`
- `src/lib/vnv/runDeterministicChecks.ts`

## Export 경로

치료사 시스템 export 경로:

- `/api/therapist/system/vnv-export`

현재 export에는 아래 항목이 포함됩니다.

- 요구사항 목록
- 추적성 매트릭스
- deterministic / core-suite 실행 결과
- 요구사항별 커버리지 행
- 최근 runtime evidence
- 전체 coverage 요약

## 권장 제출 패키지

1. 소프트웨어 요구사항 명세
2. 요구사항 추적성 매트릭스
3. deterministic SW V&V 실행 결과서
4. 치료사 시스템 export 기반 runtime evidence
5. `docs/remediation/test-runs/*` 아래 날짜별 실행 로그
6. 결함 / 재시험 기록서

## 남은 작업

- export JSON을 실제 시험기관 제출 양식에 맞게 재정리
- 릴리즈 후보마다 결함/재시험 기록과 날짜별 실행 로그를 계속 누적
