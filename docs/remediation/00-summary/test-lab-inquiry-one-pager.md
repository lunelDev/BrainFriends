# BrainFriends 시험기관 사전 문의 1페이지 요약본

## 1. 제품 개요

- 제품명: BrainFriends
- 제품 성격: 언어재활 지원용 디지털의료기기소프트웨어 준비 제품
- 사용목적:
  - 브레인프렌즈는 단계별 언어 과제를 통해 사용자의 언어 수행 데이터를 수집·정리하고, 그 결과를 사용자와 치료사가 확인할 수 있도록 지원하는 언어재활 지원 소프트웨어입니다.

## 2. 현재 구현 범위

- 사용자 기능
  - 단계별 언어 과제 수행
  - 자가진단 / 언어재활 / 노래훈련 결과 확인
- 치료사 기능
  - 사용자별 AQ 추이, 단계별 결과, 측정 품질, 메모, follow-up 확인
- 운영/검증 기능
  - SW V&V 추적성 및 deterministic 시험
  - 브라우저 저장 최소화 및 보안 이벤트 기록
  - measured-only AI 평가셋 분리, DB 저장, 버전 비교 모니터링

## 3. 현재 확보된 검증 구조

### SW V&V

- 요구사항-시험-결과 추적성 구조 구현
- deterministic SW V&V 12개 케이스 운영
- 날짜별 실행 로그 저장 가능
- V&V evidence export 가능

### 사이버보안

- 고위험 step 원시 payload의 브라우저 장기 저장 제거
- compact session / exit progress / legacy fallback 정책 문서화
- 보안 이벤트 기록 및 치료사 시스템 화면 확인 가능

### AI 성능평가

- measured-only 평가셋 분리
- DB 우선 저장, fallback 저장 경로 확보
- dataset / model / analysis version 비교 가능
- 운영 화면 및 제출형 export 가능

## 4. 확인받고 싶은 항목

1. 본 제품 범위에서 필요한 공인성적서 종류
   - SW V&V
   - 사이버보안
   - AI 성능평가
2. 현재 사용목적 문구 기준 예상 품목 / 등급 검토 방향
3. 시험기관이 요구하는 제출 문서 형식
4. AI 성능평가 시 필요한 평가셋 / 정답 라벨 / 결과서 수준
5. SaMD 준비 관점에서 우선 확보해야 하는 시험 성적서 조합

## 5. 함께 전달 가능한 문서

- 제품 정의 1장
- 공인성적서 대응 준비 현황
- SW V&V 제출 개요 및 현재 운영본 결과서
- 사이버보안 저장 현황 및 최종 고정 보고서
- AI 성능평가 제출 개요 및 현재 운영본 보고서

## 6. 참고 문서

- [제품 정의 1장](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/00-summary/brainfriends-product-definition-one-pager.md)
- [공인성적서 대응 준비 현황](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/00-summary/submission-readiness-summary.md)
- [SW V&V 제출 개요](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/01-sw-vnv/sw-vnv-submission-outline.md)
- [사이버보안 저장 현황](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/02-cybersecurity/cybersecurity-storage-inventory.md)
- [AI 성능평가 제출 개요](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/03-ai-evaluation/ai-evaluation-submission-outline.md)
