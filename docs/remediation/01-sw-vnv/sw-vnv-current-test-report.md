# SW V&V 현재 운영본 결과서

## 문서 정보

- 제품명: BrainFriends
- 범위: deterministic SW V&V 실행 결과
- 빌드 / 버전: 현재 개발 브랜치 기준
- 시험 일자: 2026-04-15
- 시험자: Codex / 개발 검증
- 시험 환경: 로컬 개발 환경, Node.js 실행 기준

## 요구사항별 커버리지 요약

| 요구사항 ID | 제목 | 검증 방법 | 연결 시험 케이스 | 결과 | 비고 |
| --- | --- | --- | --- | --- | --- |
| `SR-LOGIN-001` | 로그인 성공 후 사용자 세션 진입 | Integration | `TC-LOGIN-001`, `TC-LOGIN-THERAPIST-001` | PASS | 역할별 라우팅 fixture 기준 확인 |
| `SR-PERMISSION-002` | 카메라/마이크 권한 없으면 진입 차단 | System | `TC-PERM-001`, `TC-PERM-CANCEL-001` | PASS | 거부 및 중간 취소 모두 차단 확인 |
| `SR-SESSION-003` | Step 결과 저장 및 복원 | Integration | `TC-SESS-001`, `TC-HIST-001`, `TC-SESS-RESTORE-001`, `TC-STEP-FALLBACK-001` | PASS | 세션 복원 및 fallback 우선순위 확인 |
| `SR-SCORE-004` | AQ 점수 자동 계산 | Unit | `TC-SCORE-001` | PASS | AQ 고정 fixture 일치 |
| `SR-HISTORY-005` | 결과 리포트 저장 및 재조회 | Integration | `TC-HIST-001`, `TC-SAVE-FAIL-001`, `TC-SAVE-RETRY-001`, `TC-STEP-FALLBACK-001`, `TC-RESULT-REFETCH-001` | PASS | 저장 실패, 재시도, 결과 재조회 불일치 대응 확인 |
| `SR-MEASURE-006` | measured / partial / demo 구분 반영 | Unit | `TC-MQ-001` | PASS | 분류 fixture 일치 |

## 실행한 시험 케이스

| 시험 케이스 ID | 입력 요약 | 기대 결과 | 실제 결과 | 통과 여부 | 증적 |
| --- | --- | --- | --- | --- | --- |
| `TC-SCORE-001` | AQ 고정 fixture | AQ 값이 일정하게 계산됨 | `AQ=77.62` | PASS | deterministic run |
| `TC-MQ-001` | measured 분류 fixture | `measured`로 분류됨 | `overall=measured, step4=measured` | PASS | deterministic run |
| `TC-HIST-001` | history merge fixture | 최신 행 유지, 최대 50행 유지 | `rows=50, latestAQ=88` | PASS | deterministic run |
| `TC-LOGIN-THERAPIST-001` | 역할 라우팅 fixture | therapist/admin/patient 분기 정상 | `routes resolved as expected` | PASS | deterministic run |
| `TC-STORAGE-001` | compact history sanitization fixture | 원시 미디어 필드 제거 | `raw media fields stripped` | PASS | deterministic run |
| `TC-PERM-001` | 권한 거부 fixture | `permission_required`로 차단 | `permission_required, allowed=false` | PASS | deterministic run |
| `TC-PERM-CANCEL-001` | 권한 중간 취소 fixture | `permission_required`와 cancel reason 기록 | `permission_required, reason=permission_flow_cancelled` | PASS | deterministic run |
| `TC-SAVE-FAIL-001` | quota exceeded 저장 fixture | compact fallback + retry 상태 | `compact_history, retry=true` | PASS | deterministic run |
| `TC-SAVE-RETRY-001` | 서버 저장 실패 재시도 fixture | retry_pending 상태 전환 | `retry=true, state=retry_pending` | PASS | deterministic run |
| `TC-SESS-RESTORE-001` | signature 일치 복원 fixture | transient session 기준 복원 | `source=transient, resumeIndex=4` | PASS | deterministic run |
| `TC-STEP-FALLBACK-001` | 서버 miss fallback fixture | transient가 summary/local보다 우선 | `source=transient` | PASS | deterministic run |
| `TC-RESULT-REFETCH-001` | 서버/로컬 결과 불일치 fixture | server 결과를 canonical로 선택 | `canonical=server, mismatch=true` | PASS | deterministic run |

## 실행 로그

- deterministic 시험 명령: `npm run test:vnv`
- 날짜별 실행 로그 명령: `npm run test:vnv:record`
- 실행 로그 위치: `docs/remediation/test-runs/<YYYY-MM-DD>/*.json`
- 최신 실행 로그: `docs/remediation/test-runs/2026-04-15/08-44-30-vnv-run.json`

## 결함 / 재시험 기록

- 현재 기준 open defect: `0`
- 현재 기준 retest pending: `0`
- 상세 기록: `docs/remediation/01-sw-vnv/sw-vnv-defect-retest-log.md`

## 최종 판단

- 커버리지 상태: 현재 deterministic SW V&V 12개 케이스 통과 기준 확보
- 남은 위험: 실제 시험기관 양식에 맞춘 결과서 편집 및 현장 시험 증적 누적 필요
- 제출 권고: 내부 검토용 / 사전 상담용으로 사용 가능
