# SW V&V 시험 결과서 템플릿

## 문서 정보

- 제품명: BrainFriends
- 범위: SW V&V 런타임 증적
- 빌드 / 버전:
- 시험 일자:
- 시험자:
- 시험 환경:

## 요구사항별 커버리지 요약

| 요구사항 ID | 제목 | 검증 방법 | 연결 시험 케이스 | 결과 | 비고 |
| --- | --- | --- | --- | --- | --- |
| `SR-LOGIN-001` | 로그인 성공 후 사용자 세션 진입 | Integration | `TC-LOGIN-001`, `TC-LOGIN-THERAPIST-001` |  |  |
| `SR-PERMISSION-002` | 카메라/마이크 권한 없으면 진입 차단 | System | `TC-PERM-001` |  |  |
| `SR-SESSION-003` | Step 결과 저장 및 복원 | Integration | `TC-SESS-001`, `TC-HIST-001`, `TC-SESS-RESTORE-001`, `TC-STEP-FALLBACK-001` |  |  |
| `SR-SCORE-004` | AQ 점수 자동 계산 | Unit | `TC-SCORE-001` |  |  |
| `SR-HISTORY-005` | 결과 리포트 저장 및 재조회 | Integration | `TC-HIST-001`, `TC-SAVE-FAIL-001`, `TC-STEP-FALLBACK-001` |  |  |
| `SR-MEASURE-006` | measured / partial / demo 구분 반영 | Unit | `TC-MQ-001` |  |  |

## 실행한 시험 케이스

| 시험 케이스 ID | 입력 요약 | 기대 결과 | 실제 결과 | 통과 여부 | 증적 |
| --- | --- | --- | --- | --- | --- |
| `TC-SCORE-001` | AQ 고정 fixture | AQ 값이 일정하게 계산됨 |  |  |  |
| `TC-MQ-001` | measured 분류 fixture | `measured`로 분류됨 |  |  |  |
| `TC-HIST-001` | history merge fixture | 최신 행 유지, 최대 50행 유지 |  |  |  |
| `TC-LOGIN-THERAPIST-001` | 역할 라우팅 fixture | therapist/admin/patient 분기 정상 |  |  |  |
| `TC-STORAGE-001` | compact history sanitization fixture | 원시 미디어 필드 제거 |  |  |  |
| `TC-PERM-001` | 권한 거부 fixture | `permission_required`로 차단 |  |  |  |
| `TC-PERM-CANCEL-001` | 권한 중간 취소 fixture | `permission_required`와 cancel reason 기록 |  |  |  |
| `TC-SAVE-FAIL-001` | quota exceeded 저장 fixture | compact fallback + retry 상태 |  |  |  |
| `TC-SAVE-RETRY-001` | 서버 저장 실패 재시도 fixture | retry_pending 상태 전환 |  |  |  |
| `TC-SESS-RESTORE-001` | signature 일치 복원 fixture | transient session 기준 복원 |  |  |  |
| `TC-STEP-FALLBACK-001` | 서버 miss fallback fixture | transient가 summary/local보다 우선 |  |  |  |
| `TC-RESULT-REFETCH-001` | 서버/로컬 결과 불일치 fixture | server 결과를 canonical로 선택 |  |  |  |

## 런타임 증적 참고

- 치료사 export 경로: `/api/therapist/system/vnv-export`
- 런타임 기준 위치: `src/lib/kwab/SessionManager.ts`
- deterministic 시험 명령: `npm run test:vnv`
- 날짜별 실행 로그 명령: `npm run test:vnv:record`
- 실행 로그 위치: `docs/remediation/test-runs/<YYYY-MM-DD>/*.json`
- 타입 검증 명령: `npx tsc --noEmit`

## 결함 / 재시험 기록

| 일자 | 이슈 ID | 설명 | 수정 내용 | 재시험 결과 |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## 최종 판단

- 커버리지 상태:
- 남은 위험:
- 제출 권고:
