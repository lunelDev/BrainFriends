# KTL 후속 개발 작업리스트

작성일: 2026-05-13  
기준 문서: `ktl-meeting-developer-action-plan-2026-05-12.md`, `claim-lock.md`, `traceability-matrix.md`, `requirements.ts`

## 1. 목적

KTL 미팅 이후 개발팀이 바로 실행해야 할 작업을 `claim-lock 분기`, `V 모델 문서화`, `traceability 재정렬`, `AI 검증셋`, `사이버보안 체크리스트 재매핑` 5개 축으로 정리한다.

핵심 원칙은 다음과 같다.

- 현재 제품은 외부 문서에서 `2등급 가능성 기준으로 준비 중`으로 표현한다.
- 사업 실행은 `1등급 정보 제공/훈련 보조 우선 + 2등급 SaMD 장기 준비` 투트랙을 검토한다.
- 사용자 화면과 리포트는 기본적으로 `진단·처방·치료 결정 아님`, `전문가/치료사 검토용 참고 지표` 경계를 유지한다.
- WASM-STT는 운영 경로가 아니며, STT는 서버 보안 프록시 기반 경로로 정리한다.

---

## 2. 전체 우선순위

| 우선순위 | 작업 | 목표 산출물 | 로컬 가능 여부 | 서버 필요 여부 |
| --- | --- | --- | --- | --- |
| P0 | claim-lock 1등급/2등급 분기 | 금지어/허용어 표, UI 문구 점검표 | 가능 | 불필요 |
| P0 | V 모델 문서 세트 뼈대 | 개발계획/SRS/SDS/시험계획/검증보고서 인덱스 | 가능 | 불필요 |
| P0 | traceability 재정렬 | SR → 설계 → 코드 → TC → RM 매트릭스 | 가능 | 불필요 |
| P0 | AI 검증셋 양식 고정 | locked test set CSV, gold label, 평가 결과 JSON/CSV | 가능 | 운영 STT 실측 시 필요 |
| P1 | 사이버보안 체크리스트 재매핑 | KTL/식약처 항목 → SEC/SR/TC/증거 연결표 | 대부분 가능 | 일부 운영 로그 필요 |
| P1 | 결과 ZIP/리포트 증빙 고정 | 원음/프레임/result/scoring/version 포함 확인 | 가능 | 서버 저장 검증은 필요 |
| P1 | SOUP/SBOM/Release Manifest 연결 | SOUP, SBOM, manifest, CVE 예외 등록부 | 가능 | 불필요 |
| P2 | 운영 감사로그·침투시험 증빙 | 실제 서버 로그, 접근통제 로그, 취약점 점검 결과 | 제한적 | 필요 |

---

## 3. Claim-Lock 분기

### 목표

1등급 우선 신고 가능성을 열어두기 위해 `정보 제공/훈련 보조` 표현과 `2등급 SaMD/재활 보조` 표현을 분리한다.

### 작업 목록

| ID | 작업 | 상세 | 산출물 | 상태 |
| --- | --- | --- | --- | --- |
| CL-01 | 1등급 허용어 정의 | 자가점검, 훈련 보조, 발화 보조, 의사표현 보조, 참고 지표, 수행 기록 | `claim-lock.md` 섹션 추가 | 필요 |
| CL-02 | 1등급 금지어 정의 | 치료, 재활, 개선, 효과, 진단, 처방, 치료효과 입증 | `claim-lock.md` 섹션 추가 | 필요 |
| CL-03 | 2등급 준비 표현 유지 | 2등급 가능성, SaMD, 언어재활 보조, 치료사 검토용 지표 | 기존 claim-lock 보강 | 부분 |
| CL-04 | UI 문구 스캔 | 환자 화면, 결과 화면, 관리자 화면에서 금지어 검색 | `claim-language-audit.md` 또는 체크표 | 필요 |
| CL-05 | 노래훈련 클레임 정리 | 노래 훈련은 치료효과가 아니라 음악·리듬 기반 발화 참고 지표 | `claim-lock.md`, 결과 UI | 진행 중 |
| CL-06 | AAC 점수 경계 고정 | AAC는 발음 점수 산정 제외, 보조 의사표현 기록으로만 표시 | claim-lock + 리포트/ZIP 확인 | 부분 |
| CL-07 | STT 경로 문구 고정 | WASM-STT 제외, 서버 보안 프록시 기반 STT로 표현 | claim-lock + cloud/data 문서 | 부분 |

### 완료 기준

- `치료/진단/효과/개선` 표현이 1등급 모드 문구에 남아 있지 않다.
- 모든 결과 페이지에 `전문가/치료사 검토용 참고 지표` 경계가 표시된다.
- 제품 소개 문구가 1등급용과 2등급 준비용으로 분리되어 있다.

---

## 4. V 모델 문서화

### 목표

KTL이 강조한 `요구사항 → 설계 → 구현 → 검증 → 위험관리` 연결성을 문서 세트로 만든다.

### 작업 목록

| ID | 문서/작업 | 내용 | 현재 근거 | 상태 |
| --- | --- | --- | --- | --- |
| VM-01 | SW 개발계획서 | 범위, 역할, 일정, 형상관리, 검증 독립성 | 일부 산재 | 필요 |
| VM-02 | 사용자 요구사항 | 환자/치료사/관리자/보호자별 요구사항 | 기획·UI | 필요 |
| VM-03 | SRS 보강 | SR-* 요구사항 최신화, 1등급/2등급 분기 반영 | `requirements.ts`, `srs.md` | 부분 |
| VM-04 | SDS 보강 | 모듈별 설계, 데이터 흐름, 외부 API, 저장 구조 | `sds.md` | 부분 |
| VM-05 | 아키텍처 설계서 | 클라이언트, 서버, DB, NCP, OpenAI API 흐름 | 산재 | 필요 |
| VM-06 | 상세설계서 | 자가점검, 언어재활, 노래훈련, AAC, 리포트, ZIP export | 코드 | 필요 |
| VM-07 | 단위시험 계획/결과 | 결정성 함수 중심 TC 목록 | `runDeterministicChecks.ts` | 부분 |
| VM-08 | 통합시험 계획/결과 | STT/안면/시선/AAC/저장/리포트 흐름 | 일부 수동 | 필요 |
| VM-09 | 시스템시험 시나리오 | 환자 end-to-end, 치료사 검토, 관리자 export | 일부 | 필요 |
| VM-10 | 검증보고서 | test:vnv, tsc, build, 수동 확인 결과 요약 | 일부 | 필요 |
| VM-11 | 위험관리 연결표 | RM-*와 SR/TC/통제 연결 | `risk-management-file.md` | 부분 |
| VM-12 | 변경관리 보고서 | release manifest delta, anomaly, retest, impact | 일부 구현 | 부분 |

### 완료 기준

- 각 문서가 `문서 ID`, `버전`, `승인자`, `근거 코드`, `관련 SR/RM/TC`를 가진다.
- 최소 8~10개 문서로 분리되어 있고, 한 문서에 모든 내용을 몰아넣지 않는다.
- `README.md`에서 문서 열람 순서가 명확하다.

---

## 5. Traceability 재정렬

### 목표

현재 `traceability-matrix.md`를 KTL V 모델 관점으로 재정렬한다. 단순 요구사항 목록이 아니라 심사자가 보는 형태의 연결표로 바꾼다.

### 작업 목록

| ID | 작업 | 상세 | 산출물 | 상태 |
| --- | --- | --- | --- | --- |
| TR-01 | SR 최신 목록 확정 | `requirements.ts`의 SR-*와 문서 SR 불일치 제거 | SR inventory | 필요 |
| TR-02 | 설계 ID 추가 | SDS/Architecture section ID를 SR에 연결 | SR-Design map | 필요 |
| TR-03 | 코드 위치 추가 | 주요 파일 경로와 함수/컴포넌트 단위 연결 | code map | 부분 |
| TR-04 | TC 연결 확장 | unit/integration/system/manual test ID 연결 | TC map | 부분 |
| TR-05 | RM 연결 확장 | RM-* 위험과 통제 요구사항 연결 | RM map | 부분 |
| TR-06 | 보안 SEC 요구사항 통합 | IA/UC/SI/DC/TRE/RA 항목을 SR/TC에 연결 | security trace table | 부분 |
| TR-07 | AI 검증 항목 통합 | WER/CER/RTF/STT 실패/버전 추적 연결 | AI trace table | 부분 |
| TR-08 | AAC/Gaze/노래훈련 반영 | 5채널 및 노래훈련 지표를 traceability에 반영 | modality trace table | 부분 |
| TR-09 | export 포맷 점검 | JSON/MD/CSV export가 최신 문서 구조를 반영 | export API 결과 | 부분 |
| TR-10 | gap 컬럼 추가 | `done/partial/missing/server-needed` 상태 구분 | gap matrix | 필요 |

### 권장 매트릭스 컬럼

| 컬럼 | 설명 |
| --- | --- |
| Requirement ID | SR-* 또는 SEC-* |
| User Need | 사용자 요구사항 |
| Risk ID | RM-* |
| Design ID | SDS/Architecture 문서 섹션 |
| Implementation | 코드 경로 |
| Verification | TC-* |
| Evidence | 테스트 결과, export, ZIP, 로그 |
| Status | done / partial / missing |
| Server Needed | 서버 연결 필요 여부 |

---

## 6. AI 검증셋

### 목표

OpenAI API를 쓰더라도 제품 최종 출력 검증은 필요하다. 검증 대상은 OpenAI 모델 자체가 아니라 `BrainFriends STT/분석/리포트 파이프라인`이다.

### 작업 목록

| ID | 작업 | 상세 | 산출물 | 상태 |
| --- | --- | --- | --- | --- |
| AI-01 | 검증셋 스키마 고정 | sampleId, ageGroup, severity, device, noise, targetText, goldTranscript | CSV schema | 필요 |
| AI-02 | locked test set 규칙 | 평가 데이터 잠금, 수정 이력, 제외 기준 | dataset SOP | 필요 |
| AI-03 | gold label 기준 | SLP 또는 지정 평가자의 전사/판정 기준 | labeling guide | 필요 |
| AI-04 | STT 결과 저장 필드 | audio, target, transcript, confidence, modelId, promptHash, errorCode | result JSON | 부분 |
| AI-05 | WER/CER 계산 | 기존 runner와 검증셋 연결 | WER/CER report | 부분 |
| AI-06 | 민감도/특이도 기준 | 어떤 binary 판단을 대상으로 할지 정의 | metric definition | 필요 |
| AI-07 | RTF/latency 측정 | 처리시간, P50/P95/P99, 실패율 | RTF report | 부분 |
| AI-08 | 실패 케이스 분류 | 무음, 잡음, 네트워크 실패, STT 환각, 권한 실패 | failure taxonomy | 필요 |
| AI-09 | 모델 버전 추적 | OpenAI model, API path, app version, analysis version | version manifest | 부분 |
| AI-10 | 결과 ZIP 연계 | 원음/프레임/result/scoring/version 포함 | evidence ZIP | 부분 |
| AI-11 | 샘플 10~30건 내부 예비시험 | 언어재활·자가점검·노래훈련 실제 샘플 | pilot report | 필요 |
| AI-12 | 검증셋 제외 항목 | AAC, demo/mock, 미측정/partial 결과는 성능 검증 제외 | exclusion rule | 필요 |

### 로컬에서 먼저 할 수 있는 것

- CSV 양식 작성
- gold label 작성 가이드 작성
- WER/CER runner 입력/출력 포맷 고정
- 결과 ZIP에 `modelId`, `analysisVersion`, `measurementQuality`, `errorCode` 포함 확인
- mock/demo 결과가 검증셋에 섞이지 않도록 필터링

### 서버 연결 후 해야 할 것

- 실제 서버 STT 프록시 로그 수집
- 실제 원음 업로드/저장/삭제 정책 검증
- NCP Object Storage objectKey와 DB 결과 매핑 검증
- 동일 원음 재분석 재현성 확인

---

## 7. 사이버보안 체크리스트 재매핑

### 목표

식약처 사이버보안 가이드라인과 KTL 체크리스트를 `보안 요구사항 → 구현 → 테스트 → 증거` 형태로 재매핑한다.

### 작업 목록

| ID | 작업 | 상세 | 산출물 | 상태 |
| --- | --- | --- | --- | --- |
| SEC-01 | 35항목 최신화 | IA/UC/SI/DC/TRE/RA 항목 최신 기준 확인 | cybersecurity source table | 부분 |
| SEC-02 | KTL 체크리스트 수령 후 매핑 | KTL 항목 ID와 내부 SEC/SR ID 연결 | ktl-security-map | 대기 |
| SEC-03 | 비밀번호 정책 | 길이, 복잡도, 재사용, 초기 비밀번호 정책 | IA-05 evidence | 부분 |
| SEC-04 | 로그인 실패 잠금 | 5회 실패 잠금, unlock 정책 | IA-07 evidence | 부분 |
| SEC-05 | 세션 만료 정책 | idle timeout, absolute timeout, refresh 정책 | UC-03 evidence | 부분 |
| SEC-06 | RBAC 검증 | patient/admin/therapist/prescriber/guardian 접근권한 | UC evidence | 부분 |
| SEC-07 | 감사로그 | 로그인, 결과조회, 다운로드, 링크 생성, 권한 변경 | audit evidence | 부분 |
| SEC-08 | 전송 암호화 | HTTPS/TLS, DB SSL, API proxy | DC evidence | 부분 |
| SEC-09 | 저장 데이터 보호 | PHI/PII 분리, 마스킹, object storage 정책 | DC evidence | 부분 |
| SEC-10 | 오류 메시지 통제 | 내부 오류/민감정보 노출 방지 | SI evidence | 부분 |
| SEC-11 | 입력 검증 | zod schema, route validation, file upload 제한 | SI evidence | 부분 |
| SEC-12 | SBOM/SOUP | package, external API, model asset, version/hash | SBOM/SOUP report | 부분 |
| SEC-13 | CVE 평가 | reachability, exemption, remediation plan | CVE register | 부분 |
| SEC-14 | Release manifest | sha256, git SHA, dependency lock, model asset hash | manifest | 부분 |
| SEC-15 | 취약점 점검 | npm audit, dependency review, 외부 침투시험 | vuln report | 일부 서버 필요 |

### 완료 기준

- 각 보안 항목에 `요구사항 ID`, `구현 파일`, `테스트 케이스`, `증거 파일`, `잔여 리스크`가 있다.
- `partial` 항목은 사유와 후속 조치가 명확하다.
- 운영 서버가 필요한 항목과 로컬에서 가능한 항목이 분리되어 있다.

---

## 8. 이번 주 실행 순서

### 1일차

1. `claim-lock.md`에 1등급/2등급 문구 분기 추가
2. UI/리포트 문구 금지어 스캔 결과표 작성
3. 노래훈련/AAC/STT 경계 문구 최종 정리

### 2일차

1. `traceability-matrix.md`를 V 모델 컬럼 구조로 재작성
2. SR 목록과 `requirements.ts` 불일치 정리
3. Gaze/AAC/STT/노래훈련/ZIP export를 traceability에 추가

### 3일차

1. V 모델 문서 인덱스 작성
2. 개발계획서, 아키텍처, 시험계획서 목차 생성
3. 문서별 ID 체계 정의

### 4일차

1. AI 검증셋 CSV 양식 작성
2. gold label 작성 기준 문서 작성
3. WER/CER/RTF runner와 결과 ZIP 연동 점검

### 5일차

1. 사이버보안 35항목과 현재 코드 증거 재매핑
2. partial 항목 목록 갱신
3. KTL 체크리스트 수령 후 반영할 빈 칸 표시

---

## 9. 당장 개발자가 보면 되는 To-Do

1. `claim-lock.md`에 1등급/2등급 분기표 추가
2. `traceability-matrix.md`를 V 모델 컬럼으로 재작성
3. `requirements.ts`와 문서 SR 목록의 불일치 제거
4. 노래훈련, AAC, STT, 결과 ZIP에 대한 SR/RM/TC 연결 추가
5. AI 검증셋 CSV 템플릿과 gold label 기준 작성
6. 결과 ZIP에 원음/프레임/result/scoring/version/evidence가 빠짐없이 들어가는지 확인
7. 사이버보안 35항목을 `done/partial/missing/server-needed`로 재분류
8. SBOM/SOUP/Release manifest/CVE 예외 등록부를 traceability에 연결
9. `npm run test:vnv`, `npx tsc --noEmit`, build 결과를 검증보고서에 기록
10. KTL 체크리스트를 받으면 SEC 항목 ID와 내부 SR/TC를 다시 매핑

