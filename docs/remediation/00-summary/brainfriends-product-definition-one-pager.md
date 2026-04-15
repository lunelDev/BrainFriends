# BrainFriends 제품 정의 1장

## 1. 제품명

- 제품명: BrainFriends
- 제품 유형: 언어재활 지원용 디지털의료기기소프트웨어 준비 제품

## 2. 제품 개요

브레인프렌즈는 사용자의 언어 수행 데이터를 수집하고, 단계별 언어 과제를 통해 이해·복창·명명·유창성·읽기·쓰기 수행 결과를 정리하여 사용자와 치료사가 확인할 수 있도록 지원하는 소프트웨어입니다.

본 제품은 자가진단형 언어 과제, 언어재활 훈련, 노래 기반 훈련 흐름을 제공하며, 훈련 결과를 서버에 저장하고 이력, 측정 품질, 분석 버전, 검증 메타데이터를 함께 관리할 수 있도록 설계되어 있습니다.

## 3. 주요 사용자

### 사용자

- 언어 이해, 발화, 읽기, 쓰기 훈련 또는 자가 수행 결과 확인이 필요한 사용자
- 훈련 단계별 과제를 수행하고 결과 요약을 확인하는 주체

### 치료사

- 사용자별 수행 결과를 검토하고 경향을 확인하는 전문가 사용자
- AQ 추이, 단계별 결과, 측정 품질, 메모, 추적성 정보를 확인하는 주체

### 관리자

- 계정, 운영, 검증 자료, 시스템 상태를 관리하는 운영 사용자

## 4. 입력 데이터

- 사용자 기본 정보
  - 이름
  - 생년월일
  - 성별
  - 교육년수
  - 연락처
- 훈련 수행 입력
  - 음성 입력
  - 안면 영상 또는 안면 특징값
  - 단계별 정답/오답 선택 결과
  - 반응 시간, 녹음 시간, 읽기/쓰기 수행 정보
- 운영 입력
  - 치료사 메모
  - follow-up 상태

## 5. 출력 데이터

- AQ 점수 및 단계별 점수
- 자가진단/언어재활/노래훈련 결과 리포트
- 자음·모음 정확도, 유창성, 안면 추적 품질 등 분석 지표
- measured / partial / demo 측정 품질 구분
- 치료사 화면용 결과 요약, 추세 비교, 운영 요약
- SW V&V 추적성 메타데이터
- 보안 이벤트 및 AI 평가셋 운영 정보

## 6. 핵심 기능 범위

### 사용자 기능

- 자가진단 시작 및 단계별 진행
- 언어재활 훈련 수행
- 노래 기반 훈련 수행
- 결과 확인 및 이어하기

### 치료사 기능

- 사용자 목록 및 상세 조회
- AQ 추이 및 단계별 결과 분석
- 측정 품질 확인
- 메모 및 follow-up 기록

### 운영/검증 기능

- 결과 저장 및 이력 관리
- SW V&V 실행 로그 및 추적성 export
- 브라우저 저장 정책 및 보안 이벤트 관리
- measured-only AI 평가셋 분리 및 버전 모니터링

## 7. 사용목적

브레인프렌즈는 단계별 언어 과제를 통해 사용자의 언어 수행 데이터를 수집·정리하고, 그 결과를 사용자와 치료사가 확인할 수 있도록 지원하는 언어재활 지원 소프트웨어입니다.

## 8. 현재 구현 기준 핵심 구조

- 단계형 언어 훈련 흐름
  - Step 1~Step 6
- 공용 세션/결과 관리
  - `SessionManager`
- SW V&V 구조
  - 요구사항-시험-결과 추적성
  - deterministic check
  - dated execution log
- 사이버보안 구조
  - 브라우저 저장 최소화
  - transient step storage
  - security audit
- AI 성능평가 구조
  - measured-only 평가셋 분리
  - 버전/거버넌스 관리
  - 운영 모니터링

## 9. 현재 단계에서의 해석

본 문서는 제품의 기술적·기능적 범위를 고정하기 위한 내부 기준 문서입니다.

이 문서를 기준으로 다음 단계에서 아래 항목을 확정해야 합니다.

1. 품목/등급 판단
2. 시험기관 제출용 SW V&V 범위
3. 사이버보안 점검 범위
4. AI 성능평가 범위

## 10. 다음 연결 문서

- [공인성적서 대응 준비 현황](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/00-summary/submission-readiness-summary.md)
- [SW V&V 개요](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/01-sw-vnv/sw-vnv-submission-outline.md)
- [사이버보안 저장 현황](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/02-cybersecurity/cybersecurity-storage-inventory.md)
- [AI 성능평가 개요](C:/Users/pc/Desktop/ProjectFiles/BrainFriends/docs/remediation/03-ai-evaluation/ai-evaluation-submission-outline.md)
