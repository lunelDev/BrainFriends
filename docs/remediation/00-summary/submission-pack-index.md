# 제출용 핵심 문서 인덱스

## 목적

이 문서는 공인성적서 및 SaMD 준비 과정에서 먼저 확인해야 할 핵심 문서만 모아 둔 인덱스입니다.

문서가 많아 보여도 실제로 먼저 봐야 하는 것은 아래 5개입니다.

시험기관에 먼저 전달할 1페이지 요약본:

- [시험기관 사전 문의 1페이지 요약본](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/00-summary/test-lab-inquiry-one-pager.md)
- [시험기관 선정 기준표](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/00-summary/test-lab-selection-criteria.md)
- [시험기관 공통 문의 질문 리스트](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/00-summary/test-lab-question-list.md)
- [SaMD 준비 부족 항목 체크리스트](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/00-summary/samd-gap-checklist.md)
- [SaMD 관련 문서 경로 정리](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/00-summary/samd-document-paths.md)
- [SaMD / 공인성적서 문서 맵](file:///C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/00-summary/samd-document-map.html)
- [UI 인포그래픽 구현 체크리스트](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/00-summary/ui-infographic-implementation-checklist.md)
- [병원 / 역할 / 배정 구조 설계안](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/00-summary/organization-role-scope-design.md)
- [계정 / 기관 / 매칭 재설계안](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/00-summary/account-onboarding-redesign.md)

## 핵심 5개 문서

### 1. 제품 정의

- [제품 정의 1장](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/00-summary/brainfriends-product-definition-one-pager.md)

확인 목적:
- 제품이 무엇인지
- 사용자 / 치료사 / 관리자 역할이 무엇인지
- 입력 / 출력이 무엇인지
- 사용목적 문구가 무엇인지

### 2. 전체 준비 현황

- [공인성적서 대응 준비 현황](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/00-summary/submission-readiness-summary.md)

확인 목적:
- 지금 어떤 구조가 구현되었는지
- SW V&V / 사이버보안 / AI 성능평가가 어느 정도 준비되었는지
- 지금 당장 무엇을 검증할 수 있는지

### 3. SW V&V 제출 개요

- [SW V&V 제출 개요](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/01-sw-vnv/sw-vnv-submission-outline.md)

확인 목적:
- 요구사항, 시험 케이스, 추적성 구조 확인
- deterministic check와 runtime evidence 확인
- V&V 제출 패키지 구성을 확인

### 4. 사이버보안 저장 현황

- [사이버보안 저장 현황](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/02-cybersecurity/cybersecurity-storage-inventory.md)

확인 목적:
- 브라우저 / 서버 저장 정책 확인
- 민감 raw 데이터가 어디에 남는지 확인
- compact session, fallback, therapist notes 정책 확인

보조 문서:
- [사이버보안 최종 고정 보고서](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/02-cybersecurity/cybersecurity-final-readiness-report.md)

### 5. AI 성능평가 제출 개요

- [AI 성능평가 제출 개요](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/03-ai-evaluation/ai-evaluation-submission-outline.md)

확인 목적:
- measured-only 평가셋 구조 확인
- DB 저장 및 운영 모니터링 구조 확인
- 버전 / 거버넌스 구조 확인

보조 문서:
- [AI 성능평가 현재 운영본 보고서](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/03-ai-evaluation/ai-evaluation-current-report.md)
- [AI 오류 사례 기록서](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/03-ai-evaluation/ai-evaluation-error-case-log.md)

## 확인 순서

1. 제품 정의 1장
2. 공인성적서 대응 준비 현황
3. SW V&V 제출 개요
4. 사이버보안 저장 현황
5. AI 성능평가 제출 개요

## 참고

더 자세한 세부 문서는 각 영역 폴더에서 이어서 확인합니다.

- `01-sw-vnv/`
- `02-cybersecurity/`
- `03-ai-evaluation/`
