# BrainFriends GOLDEN

BrainFriends의 언어재활 DTx / SaMD 준비 프로젝트입니다.

## 기준 문서

- 현재 개발의 최우선 기준 문서:
  - `C:/Users/pc/Desktop/ProjectFiles/brainfriends_remediation_architecture.html`
- 주요 개발 우선순위는 아래 순서를 따릅니다.
  1. `SW V&V`
  2. `사이버보안`
  3. `AI 성능평가`
  4. `UI/UX`는 remediation 구조가 안정된 뒤 진행
- UI 작업과 remediation 구조가 충돌하면 remediation 구조를 우선합니다.
- step 훈련 화면은 특별한 제품적 이유가 없으면 기존의 집중형 인터랙션 디자인을 유지합니다.

## 현재 상태

### 이미 구현된 항목

- 로그인, 세션 확인, 사용자 bootstrap 흐름
- Step1~Step6 훈련 흐름 및 결과 계산
- 노래훈련 결과 저장 경로
- version snapshot 및 audit 성격의 메타데이터

### 최근 추가된 항목

- `src/lib/vnv/*` 구조 및 `SessionManager` 연결
- `npm run test:vnv` 기반 deterministic check
  - AQ
  - measurement quality
  - history merge
  - therapist routing
  - compact-storage sanitization
  - permission denial
  - save failure fallback
  - session restore
  - step fallback
- `src/lib/security/*` 저장 정책 구조 및 브라우저 저장 제한
- `src/lib/ai/*` measured-only 평가 구조
- `src/app/therapist/system/*` 기반 remediation 운영 화면
  - V&V export
  - 보안 이벤트
  - AI 평가셋 모니터링
  - AI 평가 export
- 결과 페이지의 server-first 처리
- `src/app/therapist/*` 치료사 화면 shell, 사용자 목록, 결과, 상세, provisioning 화면
- `src/app/api/therapist/reports/route.ts` 치료사 전용 리포트 경로
- `src/app/api/therapist/reports/note/route.ts` 및 사용자 상세 메모 / follow-up 저장 경로
- auth/session/bootstrap 흐름에서 therapist 역할 유지

## 최근 마일스톤

- 치료사 화면이 사용자 흐름과 분리됨
- 치료사 전용 API 경로가 분리됨
- therapist 역할이 auth/session/bootstrap에 반영됨
- admin이 therapist 계정을 생성할 수 있음
- therapist 로그인 시 `/therapist`로 진입
- 치료사 사용자 상세 화면에 메모, follow-up, export, media 링크, 세션 비교 기능이 포함됨

## 지금 중요한 것

- SW V&V:
  - runtime evidence / export는 구현됨
  - 제출 양식에 맞춘 마감 정리는 일부 남아 있음
- 사이버보안:
  - 고위험 브라우저 raw 저장은 많이 줄어든 상태
  - compact session / 전환기 fallback 정책은 문서로 확정됨
  - 최종 고정 보고서까지 정리됨
- AI 성능평가:
  - measured-only 수집
  - DB 저장
  - 운영 모니터링
  - 제출형 export
  구조는 구현됨

## 큰 설계 원칙

- 사용자 UI와 치료사 UI는 같은 서비스 안의 별도 제품면처럼 취급합니다.
- 사용자 UI는 `행동 중심`입니다.
  - 쉬운 문구
  - 큰 버튼
  - 내부 지표 최소 노출
- 치료사 UI는 `해석 중심`입니다.
  - KPI
  - AQ 추이
  - Step1~Step6 결과
  - 측정 품질
  - 저장 상태
  - 추적성 정보
- 사용자 라우트:
  - `src/app/page.tsx`
  - `src/app/(training)/*`
  - `src/app/(result)/result-page/*`
- 치료사 라우트:
  - `src/app/therapist/*`
- SW V&V, 사이버보안, AI 성능평가 구조는 문서에만 있는 것이 아니라 실제 런타임 흐름에 연결되어 있어야 합니다.

## 현재 우선순위

1. `brainfriends_remediation_architecture.html` 기준으로 SW V&V 마무리
2. 브라우저 저장 정리와 서버 우선 원시데이터 처리 마무리
3. AI 평가셋 운영 및 데이터셋 거버넌스 마무리
4. remediation 구조 안정화 후 사용자/치료사 UI 작업 재개

## UI 방향

### 사용자 UI

- 목적: 다음 행동을 명확하게 안내
- 주요 경로:
  - `src/app/page.tsx`
  - `src/app/(training)/*`
  - `src/app/(result)/result-page/*`
- 원칙:
  - 쉬운 문구
  - 큰 행동 버튼
  - 내부 지표 최소화

### 치료사 UI

- 목적: 결과 해석, 비교, 추적성 확인
- 주요 경로:
  - `src/app/therapist/*`
- 현재 데이터 진입점:
  - `src/app/tools/admin-reports/page.tsx`
  - `src/app/tools/training-usage-admin/page.tsx`
  - `src/app/tools/training-usage-timeline/page.tsx`
- 원칙:
  - 분석 중심
  - measured quality 표시
  - server-save 상태 표시

## 다음 단계

### 묶음 1: SW V&V 마무리

- 요구사항 / 시험 케이스 / 결과 export 형식 정리
- runtime evidence 요약 및 치료사 검토 흐름 정리
- 현재 12개 deterministic check 운영 및 릴리즈별 예외 시나리오 증적 누적

### 묶음 2: 사이버보안 마무리

- 남은 브라우저 저장 항목 점검
- 원시데이터 server-first 전략 유지 확인
- 저장 항목표와 보안 이벤트 검토

### 묶음 3: AI 성능평가 마무리

- measured-only 샘플 모니터링
- dataset version / model version 비교
- 평가 샘플 운영 검토 경로 유지

### 묶음 4: remediation 이후 UI 구현

- 사용자 홈 / 훈련 / 결과 정리
- 치료사 대시보드 / 사용자 상세 정리

## 권장 일정

### Day 1

- SW V&V runtime evidence 및 export 검토

### Day 2

- 사이버보안 브라우저 저장 정리

### Day 3

- AI 성능평가 모니터링 및 버전 요약

### Day 4

- SW V&V / 보안 / AI 성능평가 통합 점검

### Day 5

- 사용자 홈 UI

### Day 6

- 사용자 훈련 / 결과 UI

### Day 7

- 치료사 대시보드 / 상세 UI 정리

## 작업 큐

### 핵심 모듈

- `src/lib/vnv/requirements.ts`
- `src/lib/vnv/traceability.ts`
- `src/lib/vnv/testRunner.ts`
- `src/lib/security/storagePolicy.ts`
- `src/lib/security/secureStorage.ts`
- `src/lib/security/patientRedaction.ts`
- `src/lib/ai/measurementTypes.ts`
- `src/lib/ai/evaluationDataset.ts`
- `src/lib/ai/performanceMetrics.ts`
- `src/lib/ai/modelGovernance.ts`
- `src/lib/ai/measurementCollector.ts`

### 현재 주요 변경 파일

- `src/lib/storage/adapters.ts`
- `src/lib/storage/managedStorage.ts`
- `src/app/layout.tsx`
- `src/lib/patientStorage.ts`
- `src/lib/kwab/SessionManager.ts`
- `src/app/(result)/result-page/*`
- `src/app/api/*`
- `src/lib/server/*`
- `src/app/therapist/*`

## 완료 기준

- 민감 raw 측정 데이터가 브라우저에 장기 저장되지 않음
- 결과 페이지가 서버 저장 데이터를 우선 사용함
- measured-only 샘플이 평가용으로 분리됨
- 핵심 런타임 흐름에 요구사항 연결 메타데이터가 남음
- 치료사 화면이 사용자 흐름과 분리되어 있음

## 검증 체크리스트

- 로그인 및 세션 복원이 정상 동작하는가
- step 진행 복원이 정상 동작하는가
- AQ 계산이 정상 동작하는가
- 결과 저장이 정상 동작하는가
- measured / partial / demo 분류가 정상 동작하는가
- 치료사 라우트가 정상 열리고 현재 도구와 연결되는가

## 참고

- `npx tsc --noEmit` 통과 상태
- `npm run test:vnv` 현재 12개 deterministic check 통과
- `npm run test:vnv:record` 실행 시 `docs/remediation/test-runs/*` 아래에 날짜별 실행 로그 저장
- 현재 최우선은 remediation-first:
  - SW V&V
  - 사이버보안
  - AI 성능평가
- `brainfriends_remediation_architecture.html`이 현재 개발 기준 문서
- UI 작업은 remediation 구조가 안정될 때까지 보조 우선순위
- 공인성적서 대응 문서는 `docs/remediation/README.md`를 시작점으로 확인
- 사이버보안 최종 정책은 `docs/remediation/02-cybersecurity/cybersecurity-policy-decisions.md`에 정리
