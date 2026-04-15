# 공인성적서 대응 문서 안내

## 권장 확인 순서

1. `00-summary`
2. `01-sw-vnv`
3. `02-cybersecurity`
4. `03-ai-evaluation`
5. `test-runs`

## 폴더 설명

### 00-summary

- `submission-readiness-summary.md`
- `brainfriends-product-definition-one-pager.md`

전체 상황과 제품 정의를 가장 먼저 볼 때 사용하는 폴더입니다.

### 01-sw-vnv

- `sw-vnv-submission-outline.md`
- `sw-vnv-test-report-template.md`
- `sw-vnv-defect-retest-log.md`
- `sw-vnv-execution-log-policy.md`

요구사항 추적성, 시험 증적, 결함/재시험 관리 자료를 담고 있습니다.

### 02-cybersecurity

- `browser-server-storage-matrix.md`
- `cybersecurity-storage-inventory.md`
- `cybersecurity-policy-decisions.md`
- `cybersecurity-final-readiness-report.md`
- `sensitive-data-classification.md`

브라우저/서버 저장 정책, 민감정보 분류, 보안 최종 결정 내용을 담고 있습니다.

### 03-ai-evaluation

- `ai-evaluation-submission-outline.md`
- `ai-evaluation-dataset-definition.md`
- `ai-evaluation-current-report.md`
- `ai-evaluation-error-case-log.md`

measured-only 평가셋, 버전 관리, 성능평가 제출 자료와 현재 운영본 기록을 담고 있습니다.

### test-runs

- `npm run test:vnv:record` 실행 시 생성되는 날짜별 SW V&V 실행 로그

## 참고

- `test-runs`는 자동 생성 증적입니다.
- 그 외 문서는 제출과 내부 검토를 위한 기준 문서입니다.
