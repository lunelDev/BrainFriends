# SW V&V 결함 / 재시험 기록서

## 문서 정보

- 제품명: BrainFriends
- 범위: SW V&V deterministic / runtime evidence 검토
- 관리 주체: 개발 / QA
- 마지막 갱신일: 2026-04-15

## 현재 운영 상태

- 현재 열려 있는 결함 수: `0`
- 현재 재시험 대기 수: `0`
- 현재 deterministic 시험 명령: `npm run test:vnv`
- 현재 날짜별 실행 로그 명령: `npm run test:vnv:record`
- 현재 실행 로그 위치: `docs/remediation/test-runs/<YYYY-MM-DD>/*.json`

## 현재 기록

| 일자 | 이슈 ID | 요구사항 ID | 시험 케이스 ID | 설명 | 수정 내용 | 재시험 일자 | 재시험 결과 | 담당자 | 상태 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-04-15 | N/A | N/A | N/A | 현재 기준 deterministic V&V 12개 케이스 모두 통과 | 해당 없음 | 2026-04-15 | PASS | Dev | Closed |

## 운영 규칙

1. 코드 수정 후 `npx tsc --noEmit`와 `npm run test:vnv`를 먼저 실행합니다.
2. 제출용 증적을 남길 때는 `npm run test:vnv:record`를 실행해 날짜별 JSON 로그를 생성합니다.
3. FAIL 또는 WARN이 발생하면 이 문서에 이슈 행을 추가하고, 재시험 전까지 `Status=Open` 또는 `Retest Pending`으로 유지합니다.
4. 수정 완료 후 재시험 일자와 결과를 기록하고 `Status=Closed`로 변경합니다.

## 다음 기록 템플릿

| 일자 | 이슈 ID | 요구사항 ID | 시험 케이스 ID | 설명 | 수정 내용 | 재시험 일자 | 재시험 결과 | 담당자 | 상태 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |  |  |
