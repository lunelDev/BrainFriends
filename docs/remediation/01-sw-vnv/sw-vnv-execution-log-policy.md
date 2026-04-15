# SW V&V 실행 로그 정책

## 목적

BrainFriends의 SW V&V 시험 실행 결과를 날짜 기준으로 남기고, 제출용 증적과 내부 재시험 기록을 연결하기 위한 운영 기준입니다.

## 실행 명령

- 기본 deterministic 실행: `npm run test:vnv`
- 날짜별 실행 로그 저장: `npm run test:vnv:record`
- 타입 검증: `npx tsc --noEmit`

## 저장 규칙

- 저장 루트: `docs/remediation/test-runs`
- 저장 구조: `docs/remediation/test-runs/<YYYY-MM-DD>/<HH-MM-SS>-vnv-run.json`
- 각 JSON에는 아래 항목이 포함됩니다.
  - 생성 시각
  - 총 시험 수 / PASS / FAIL 요약
  - 개별 시험 케이스 ID
  - 연결 요구사항 ID
  - 입력 요약 / 기대 결과 / 실제 결과

## 검토 규칙

1. 제출 직전 실행 결과는 반드시 `npm run test:vnv:record`로 남깁니다.
2. FAIL 또는 WARN이 발생하면 `sw-vnv-defect-retest-log.md`에 즉시 기록합니다.
3. 최근 실행 로그 경로는 치료사 V&V export JSON에서도 함께 확인합니다.
