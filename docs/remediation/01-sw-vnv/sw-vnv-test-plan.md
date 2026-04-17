# SW V&V 시험 계획서

## 문서 정보

| 항목 | 내용 |
| --- | --- |
| 제품명 | BrainFriends |
| 문서 유형 | 소프트웨어 검증 및 확인(V&V) 시험 계획서 |
| 버전 | 1.0 |
| 작성일 | 2026-04-17 |
| 참조 규격 | IEC 62304, 식약처 디지털의료기기 소프트웨어 허가심사 가이드라인 |

---

## 1. 목적

이 문서는 BrainFriends 소프트웨어의 요구사항이 올바르게 구현되었는지 검증(Verification)하고 확인(Validation)하기 위한 시험 계획을 정의합니다.

시험의 목적은 다음과 같습니다.

- 각 소프트웨어 요구사항이 코드 수준에서 올바르게 구현되었음을 확인
- 결정론적(deterministic) 실행 증적을 생성하여 제출 가능한 시험 증적으로 활용
- 요구사항 → 시험 케이스 → 결과의 추적성을 확보

---

## 2. 시험 범위

### 2.1 시험 대상 요구사항

이 시험 계획이 다루는 소프트웨어 요구사항은 다음과 같습니다.

| 요구사항 ID | 제목 | 구현 위치 |
| --- | --- | --- |
| `SR-LOGIN-001` | 로그인 성공 후 역할 기반 세션 진입 | `src/app/page.tsx`, `src/lib/server/accountAuth.ts` |
| `SR-PERMISSION-002` | 카메라/마이크 권한 없으면 진입 차단 | `src/app/page.tsx` |
| `SR-SESSION-003` | Step 결과 저장 및 복원 | `src/lib/kwab/SessionManager.ts` |
| `SR-SCORE-004` | AQ 점수 자동 계산 | `src/lib/kwab/KWABScoring.ts`, `SessionManager.ts` |
| `SR-HISTORY-005` | 결과 리포트 저장 및 재조회 | `SessionManager.ts`, `src/lib/server/clinicalResultsDb.ts` |
| `SR-MEASURE-006` | measured / partial / demo 구분 반영 | `src/lib/vnv/deterministicChecks.ts`, `SessionManager.ts` |

### 2.2 시험 제외 범위

다음 항목은 이 시험 계획의 범위에서 제외합니다.

- 사용자 인터페이스(UI) 시각적 검증 (별도 사용적합성 시험으로 다룸)
- 음성 STT 정확도 (별도 AI 성능평가 계획으로 다룸)
- 안면 추적 정확도 (별도 AI 성능평가 계획으로 다룸)
- 네트워크 부하 시험, 성능 부하 시험

---

## 3. 시험 접근 방법

### 3.1 결정론적 시험 (Deterministic Testing)

BrainFriends V&V의 핵심 방법은 **고정 입력 fixture 기반 결정론적 시험**입니다.

- 외부 서비스(DB, OpenAI STT 등) 호출 없이 순수 로직만 검증
- 동일한 입력에 대해 동일한 출력이 반드시 보장되어야 함
- 실행마다 JSON 로그를 날짜/시각 기준으로 저장
- 시험 결과 재현성: 언제 실행해도 동일한 결과를 기대

### 3.2 통합 시험 (Integration Testing)

로그인 흐름, 세션 저장/복원, 결과 저장 등 컴포넌트 간 연동을 검증하는 fixture 기반 통합 시험을 포함합니다.

### 3.3 단위 시험 (Unit Testing)

AQ 점수 계산, 측정 품질 분류 등 독립적인 계산 로직은 단위 시험으로 검증합니다.

---

## 4. 시험 환경

| 항목 | 내용 |
| --- | --- |
| 운영 체제 | Windows 11 / macOS (개발 환경) |
| 런타임 | Node.js (프로젝트 버전 기준) |
| 데이터베이스 | 시험 실행 중 DB 연결 없음 (fixture 기반) |
| 외부 서비스 | 없음 (STT, 안면 분석 호출 없음) |
| 시험 실행 도구 | `npm run test:vnv`, `npm run test:vnv:record` |
| 타입 검증 | `npx tsc --noEmit` |

---

## 5. 시험 케이스 목록

### 5.1 단위 시험 케이스

| TC ID | 연결 SR | 시험 목적 | 입력 | 기대 결과 | 시험 방법 |
| --- | --- | --- | --- | --- | --- |
| `TC-SCORE-001` | `SR-SCORE-004` | AQ 계산 결정론적 검증 | 고정된 K-WAB 하위 검사 점수 fixture (스스로말하기/알아듣기/따라말하기/이름대기) | `AQ=77.62` (소수점 2자리 고정) | Unit, deterministic |
| `TC-MQ-001` | `SR-MEASURE-006` | measured 분류 검증 | step4 transcript 포함 fixture | `overall=measured, step4=measured` | Unit, deterministic |

### 5.2 통합 시험 케이스

| TC ID | 연결 SR | 시험 목적 | 입력 | 기대 결과 | 시험 방법 |
| --- | --- | --- | --- | --- | --- |
| `TC-LOGIN-THERAPIST-001` | `SR-LOGIN-001` | 역할 기반 라우팅 검증 | therapist / admin / patient 역할 fixture | 각 역할이 therapist화면 / 모드선택 / step-1로 분기 | Integration, fixture |
| `TC-HIST-001` | `SR-SESSION-003`, `SR-HISTORY-005` | history 저장 병합 검증 | 50건 기존 history + 동일 세션 신규 결과 | 최신 행 유지, 50행 상한 유지, `latestAQ=88` | Integration, fixture |
| `TC-STORAGE-001` | `SR-SESSION-003`, `SR-HISTORY-005` | compact history 민감 필드 제거 검증 | 원시 미디어 payload 포함 history entry | raw media 필드 제거, compact history만 유지 | Integration, fixture |
| `TC-SAVE-FAIL-001` | `SR-HISTORY-005` | 저장 실패 시 compact fallback 검증 | quota exceeded 저장 시도 fixture | `compact_history, retry=true` | Integration, fixture |
| `TC-SAVE-RETRY-001` | `SR-HISTORY-005` | 서버 저장 실패 후 재시도 상태 검증 | 서버 저장 실패 fixture | `retry=true, state=retry_pending` | Integration, fixture |
| `TC-SESS-RESTORE-001` | `SR-SESSION-003` | 세션 복원 검증 | signature 일치 transient session fixture | `source=transient, resumeIndex=4` | Integration, fixture |
| `TC-STEP-FALLBACK-001` | `SR-SESSION-003`, `SR-HISTORY-005` | fallback 우선순위 검증 | server miss + transient/session/legacy 모두 존재 fixture | `source=transient` (transient 최우선) | Integration, fixture |
| `TC-RESULT-REFETCH-001` | `SR-HISTORY-005` | 결과 재조회 불일치 시 server-first 검증 | 서버/로컬 결과 불일치 fixture | `canonical=server, mismatch=true` | Integration, fixture |

### 5.3 시스템 시험 케이스

| TC ID | 연결 SR | 시험 목적 | 입력 | 기대 결과 | 시험 방법 |
| --- | --- | --- | --- | --- | --- |
| `TC-PERM-001` | `SR-PERMISSION-002` | 권한 거부 시 진입 차단 검증 | 카메라/마이크 권한 거부 fixture | `permission_required, allowed=false` | System, fixture |
| `TC-PERM-CANCEL-001` | `SR-PERMISSION-002` | 권한 요청 중 취소 처리 검증 | 권한 요청 중 마이크 권한 취소 fixture | `permission_required, reason=permission_flow_cancelled` | System, fixture |

---

## 6. 합격 기준 (Pass/Fail Criteria)

### 6.1 개별 시험 케이스 합격 기준

- 실제 결과(actual)가 기대 결과(expected)와 완전히 일치하면 PASS
- 수치 비교 시 소수점 2자리 기준으로 판정
- 부분 일치 또는 결과 누락은 FAIL로 판정

### 6.2 전체 시험 합격 기준

- 전체 시험 케이스 12개 중 12개 PASS: 제출 권고
- FAIL 1건 이상 존재: 결함 기록 후 수정 및 재시험 필수
- FAIL 해소 전 제출 불가

### 6.3 타입 검증 합격 기준

- `npx tsc --noEmit` 실행 결과 오류 0건: 합격
- 오류 1건 이상: 해소 후 재실행 필수

---

## 7. 시험 실행 절차

### 7.1 실행 전 준비

1. 프로젝트 의존성 설치 확인: `npm install`
2. 환경 변수 파일 확인: `.env.local` (시험 실행에는 DB 연결 불필요)
3. 타입 검증 실행: `npx tsc --noEmit`

### 7.2 시험 실행

```bash
# 기본 deterministic 실행 (결과 확인용)
npm run test:vnv

# 날짜별 실행 로그 저장 (제출용 증적 생성)
npm run test:vnv:record
```

### 7.3 실행 후 확인

1. 콘솔 출력에서 `totalCases / passedCases / failedCases` 확인
2. `docs/remediation/test-runs/<YYYY-MM-DD>/` 폴더에 JSON 로그 생성 확인
3. JSON 로그 내 각 케이스 `passed: true` 확인
4. FAIL 발생 시 `sw-vnv-defect-retest-log.md`에 즉시 기록

---

## 8. 결함 관리 절차

1. FAIL 발생 시 `sw-vnv-defect-retest-log.md`에 이슈 ID, 발생일, 설명, 재현 방법 기록
2. 수정 완료 후 `npm run test:vnv:record`로 재시험 실행
3. 재시험 결과(PASS)를 결함 기록서에 반영
4. Open defect 0건 상태에서만 제출 진행

---

## 9. 증적 관리

| 증적 유형 | 저장 위치 | 생성 방법 |
| --- | --- | --- |
| 날짜별 V&V 실행 로그 | `docs/remediation/test-runs/<YYYY-MM-DD>/<HH-MM-SS>-vnv-run.json` | `npm run test:vnv:record` |
| 현재 운영본 결과서 | `docs/remediation/01-sw-vnv/sw-vnv-current-test-report.md` | 수동 업데이트 |
| 결함/재시험 기록 | `docs/remediation/01-sw-vnv/sw-vnv-defect-retest-log.md` | 수동 기록 |
| 치료사 export | `/api/therapist/system/vnv-export` | 운영 화면에서 다운로드 |

---

## 10. 추적성 매트릭스

| 요구사항 ID | 연결 시험 케이스 | 커버리지 |
| --- | --- | --- |
| `SR-LOGIN-001` | `TC-LOGIN-THERAPIST-001` | ✅ |
| `SR-PERMISSION-002` | `TC-PERM-001`, `TC-PERM-CANCEL-001` | ✅ |
| `SR-SESSION-003` | `TC-HIST-001`, `TC-STORAGE-001`, `TC-SESS-RESTORE-001`, `TC-STEP-FALLBACK-001` | ✅ |
| `SR-SCORE-004` | `TC-SCORE-001` | ✅ |
| `SR-HISTORY-005` | `TC-HIST-001`, `TC-STORAGE-001`, `TC-SAVE-FAIL-001`, `TC-SAVE-RETRY-001`, `TC-STEP-FALLBACK-001`, `TC-RESULT-REFETCH-001` | ✅ |
| `SR-MEASURE-006` | `TC-MQ-001` | ✅ |

---

## 11. 역할 및 책임

| 역할 | 책임 |
| --- | --- |
| 시험 계획 작성자 | 시험 범위, 방법, 합격 기준 정의 |
| 시험 실행자 | `npm run test:vnv:record` 실행 및 로그 확인 |
| 결함 관리자 | FAIL 발생 시 결함 기록 및 재시험 확인 |
| 검토자 | 시험 결과서 최종 검토 및 제출 승인 |

---

## 12. 관련 문서

- [SW V&V 현재 운영본 결과서](./sw-vnv-current-test-report.md)
- [SW V&V 결함/재시험 기록서](./sw-vnv-defect-retest-log.md)
- [SW V&V 실행 로그 정책](./sw-vnv-execution-log-policy.md)
- [SW V&V 시험 결과서 템플릿](./sw-vnv-test-report-template.md)
- [제품 정의 1장](../00-summary/brainfriends-product-definition-one-pager.md)
