# 식약처 사전상담 자료 패키지 v1.0

작성일: 2026-04-30
대상: 식약처 디지털의료제품지원총괄과 사전상담 신청 시 첨부
범위: 1차 SaMD 신청 + DTx 후속 결정 (NIDS 답변 기준 SaMD ⊃ DTx)
관련 결정: `docs/decisions/2026-04-30-nids-samd-dtx-relationship.md`

## 0. 한 줄 요약

브레인프렌즈는 **독립형 디지털의료기기소프트웨어(SaMD) 2등급 가능성** 을 기준으로 자체 V&V 53 TC PASS, 사이버보안 35 항목 약 77% 충족, RM 21건, IEC 62304 SRS/SDS, IEC 62366 사용성 프로토콜, GMP 결정 매트릭스를 갖춘 상태로 사전상담을 신청한다. 본 패키지는 6개 핵심 질의와 13개 분류된 첨부자료 인덱스를 제공한다.

## 1. 사전상담 질의 사항

본 사전상담의 핵심 질의는 다음과 같다 (질의 우선순위 순). **각 질의 옆에 우리가 보유한 근거 산출물 + 회신에 따른 후속 의사결정 트리거를 명시**.

### Q1. 품목분류 확정

| 항목 | 내용 |
|---|---|
| 질의 | 독립형 디지털의료기기소프트웨어 (SaMD) 분류 적합성 + 등급 (2등급 가능?) |
| 우리 입장 | SaMD 2등급, 정보제공·관리형 |
| 근거 | `intended-use-and-contraindications.md`, `digital-medical-product-gap-matrix.md` §2-§3, `claim-lock.md` v0.3.0 §3 |
| 후속 트리거 | (a) 2등급 확정 → 그대로 진행 / (b) 3등급 권고 → RM v1.0 §3 등급 재평가 + DTx 트랙 동시 검토 |

### Q2. DTx 분류 동시 신청 여부

| 항목 | 내용 |
|---|---|
| 질의 | NIDS 답변에 따라 SaMD ⊃ DTx 구조 확인. 1차 SaMD 신청에 DTx 첨부자료 (PDF #7 §III.2 8종) 동시 제출 vs 변경허가로 후속 신청 권고 |
| 우리 입장 | 1차는 SaMD 정보제공·관리형으로 진입, DTx 분류는 부산대 / 서울 Big5 RCT 자료 확보 후 후속 변경허가 또는 동시 첨부 결정 |
| 근거 | `2026-04-30-nids-samd-dtx-relationship.md`, `clinical/dtx-rct-protocol-skeleton-v0.1.md`, `clinical/pi-candidate-list-and-outreach.md` |
| 후속 트리거 | (a) 동시 신청 권장 → RCT 진행 timing 가속 / (b) 후속 변경허가 OK → 1차 시판 timing 우선 |

### Q3. 사용목적 표현 적합성

| 항목 | 내용 |
|---|---|
| 질의 | 본 패키지 §3.1 사용목적 문구 (claim-lock §3 잠금) 의 식약처 적합성 + 표현 권고 |
| 우리 입장 | "의료진의 관리하에 언어재활 훈련 수행과 경과 모니터링을 보조" 표현으로 좁힘 (MCI 제외, AI 자동 진단 표현 금지) |
| 근거 | `claim-lock.md` v0.3.0 §3·§5 (금지 표현 10건), `intended-use-and-contraindications.md` |
| 후속 트리거 | 표현 수정 권고 → claim-lock §6 치환표에 추가 + cross-reference 4개 동시 갱신 |

### Q4. 임상시험 면제 가능 여부

| 항목 | 내용 |
|---|---|
| 질의 | 정보제공·관리형 SaMD 로 1차 신청 시 임상시험 면제 적용 여부 |
| 우리 입장 | 면제 가능 트랙 우선 시도. 후속 DTx 인정용 RCT 는 별도 timing 으로 병행 |
| 근거 | `mfds-guideline-gap-analysis.md` §4-3 (정정된 단계 진입 모델), `claim-lock.md` v0.3.0 §4 (조건부 클레임) |
| 후속 트리거 | (a) 면제 OK → 시판 timing 단축 / (b) 임상자료 필수 → DTx 동시 신청 트랙으로 전환 |

### Q5. AI 알고리즘 변경관리 빈도

| 항목 | 내용 |
|---|---|
| 질의 | WASM Whisper-tiny / MediaPipe FaceLandmarker / IRT 모델 변경 시 변경허가 빈도 권고 (분기 / 반기 / 연간) |
| 우리 입장 | 분기 모델 재평가 + release manifest delta 기반 자동 영향분석 + 변경허가 사전 판정 함수 보유 |
| 근거 | `change-approval-sop.md` v0.1, `lib/server/changeImpactAnalysis.ts`, `SR-CHANGE-016`, `release manifest sha256 동결` |
| 후속 트리거 | 식약처 권고 빈도에 맞춰 SOP §4 변경 분류 7종 갱신 + PMS 보고 주기 동기화 |

### Q6. 사용성평가 위탁시험기관 권고

| 항목 | 내용 |
|---|---|
| 질의 | IEC 62366 사용성평가 (formative 5/5/5~8 + summative 15) 자체 가능 vs 위탁 권고 |
| 우리 입장 | 프로토콜·IRB 패키지 자체 보유. 실제 실시는 위탁 권장. 후보 시험기관 사전 추천 요청 |
| 근거 | `usability-evaluation-protocol.md` v0.1, `usability-evaluation-irb-package.md` v0.1 |
| 후속 트리거 | 위탁 권고 → RFP 발송 (`docs/regulatory/usability-test-rfp.md` 별도 작성 예정) |

## 2. 첨부 자료 인덱스

| 분류 | 산출물 | 본 패키지 § |
|---|---|---|
| **A. 사용목적·작용원리** | `intended-use-and-contraindications.md` v0.1 | §3.1 |
| | `ai-role-boundary.md` v0.1 | §3.2 |
| | `cloud-and-data-transfer.md` v0.1 | §3.3 |
| **B. 클레임 잠금** | `claim-lock.md` **v0.3.0** | §4 |
| **C. 위험관리** | `risk-management-file.md` **v1.0** | §5 |
| | `digital-medical-product-gap-matrix.md` v0.2 | §5.2 |
| **D. SW 안전성 등급** | (RM v1.0 §3 Class B 권고) | §5.1 |
| **E. SW V&V** | `runDeterministicChecks.ts` (**53 TC**) | §6.1 |
| | IEC 62304 별지 제2호 export (`lib/vnv/iec62304Export.ts`) | §6.2 |
| | `srs.md` v0.1 + `sds.md` v0.1 + `traceability-matrix.md` v0.1 | §6.3 |
| **F. 사이버보안** | `cve-exemptions.md` v0.1 + SBOM/SOUP/Manifest | §7 |
| | `cybersecurity-final-readiness-report.md` | §7 |
| **G. AI 성능평가** | `ai-evaluation-data-collection-guide.md` v0.1 + dry-run 결과 | §8 |
| | `wasm-stt-model-evaluation-plan.md` v0.1 (3단계 결정 게이트) | §8 |
| **H. 사용적합성** | `usability-evaluation-protocol.md` v0.1 | §9 |
| | `usability-evaluation-irb-package.md` v0.1 | §9 |
| **I. 변경관리** | `change-approval-sop.md` v0.1 + `analyzeChangeImpact` | §10 |
| **J. 시판 후 감시** | `post-market-surveillance-plan.md` v0.1 + `pms-capa-procedure.md` v0.1 | §11 |
| **K. GMP/QMS 준비** | `gmp-qms-decision-matrix.md` v0.1 (옵션 미확정) | §12 |
| **L. NIDS 답변** | `2026-04-30-nids-samd-dtx-relationship.md` | §13 |
| **M. 사용자 매뉴얼** | `manual-therapist.md` v0.1, `manual-patient.md` v0.1, `manual-guardian.md` v0.1 | §14 |

## 3. 핵심 본문 발췌

### 3.1 사용목적 (intended use)

> 브레인프렌즈는 뇌졸중, 외상성 뇌손상, 기타 뇌질환 이후 발생한 실어증 또는 마비말장애 환자를 대상으로, 의료진의 관리하에 언어재활 훈련 수행과 경과 모니터링을 보조하기 위해 사용하는 독립형 디지털의료기기소프트웨어이다.

훈련/평가 시나리오는 가정, 병원, 커피숍, 은행, 공원, 마트 6개 장면(PlaceType)에 대해 제공되며, 각 장면별로 사물 어휘 / 발화 의도 / 청각 이해 / 쓰기 / 유창성 시나리오가 매핑되어 있다.

(claim-lock v0.3.0 §3 + intended-use-and-contraindications.md)

### 3.2 AI 역할 경계

> 브레인프렌즈의 AI 분석 결과는 치료사의 임상적 판단을 보조하기 위한 참고 지표이며, 최종 평가와 치료 결정은 의료진이 수행한다.

### 3.3 데이터 처리

> 안면·시선 분석과 일상·게임 훈련 STT 는 브라우저 내 WASM 기반 온디바이스 처리를 적용하며, 주간 K-WAB·임상평가 STT 는 보안 정책이 적용된 서버 Whisper 경로를 사용한다.

### 3.4 위험통제 핵심 (RM v1.0 발췌)

> RM-001 ~ RM-021 의 21건 위해요인은 결정성 V&V 53 TC + IEC 62366 사용성 12 시나리오 + 사이버보안 TC-SEC-* 10건 + 처방·금기 통제로 매핑·검증된다.

## 4. 산출물 양적 요약 (v1.0 갱신)

| 항목 | 수치 | 변동 |
|---|---|---|
| 결정성 V&V 테스트 케이스 | **53건** (TC-* 모두 PASS) | v0.1: 49건 |
| 소프트웨어 요구사항 | **35건** (SR-*) | v0.1: 31건 |
| 추적성 매트릭스 행 | **51행** | v0.1: 47행 |
| 위험관리 위해요인 | **21건** (RM-001 ~ RM-021) | (변동 없음) |
| 사이버보안 가이드라인 35 항목 일치도 | **~77%** | (변동 없음) |
| IEC 62366 사용성 시나리오 | **12건** (POF 12 + critical 2) | (변동 없음) |
| 사용자 매뉴얼 | **3종** (치료사·환자·보호자) | v0.1 시점 부재 → v1.0 추가 |
| AI 성능평가 도구 | WER/CER runner ✅ + RTF/P95 runner ✅ | (변동 없음) |
| IRT 적응형 알고리즘 | 결정성 구현 ✅ + item bank v0.1 | (변동 없음) |
| WASM 온디바이스 STT | transformers.js@4.2.0 wiring ✅ | (변동 없음) |
| 외부 협력 패키지 | 부산대 / 서울 Big5 PI 후보 11곳 + 콜드메일 템플릿 3종 | (변동 없음) |

## 5. 사전상담 신청 절차 (v1.0 신규)

### 5.1 신청 경로

식약처 디지털의료제품지원총괄과 — 사전상담 운영 절차에 따른다. 일반적으로:

1. 식약처 홈페이지 → 민원 → 사전상담 신청서 다운로드
2. 신청서 + 본 패키지 (zip) + 첨부 자료 인덱스 §2 의 산출물 일체 제출
3. 회신: 통상 4~6주 (담당자 배정 후 회의 일정 협의)

### 5.2 신청서 양식 (간단 템플릿)

```
신청기업: (주)골든브레인케어
대표자: 이현송
제품명 (가칭): 브레인프렌즈
1차 분류 의견: 독립형 디지털의료기기소프트웨어 (SaMD) 2등급
DTx 트랙: NIDS 답변 기준 SaMD ⊃ DTx — 후속 변경허가 또는 동시 신청 검토 중
사용목적: (claim-lock v0.3.0 §3 잠금 문구 그대로)
주요 핵심 질의: Q1~Q6 (본 패키지 §1)
첨부: 본 패키지 (인덱스 §2) — 13 분류 / ~30 산출물 / V&V 53 TC PASS
연락: hyunsong635@gmail.com / 010-XXXX-XXXX (실무: 박지수 팀장)
```

### 5.3 예상 비용

식약처 사전상담은 통상 **무료** (디지털의료제품지원총괄과 운영). 단 외주 컨설팅 동행 시 별도 비용 발생.

### 5.4 권장 일정 (D-day = 사전상담 회의일)

| D-day 기준 | 활동 |
|---|---|
| D-30 ~ D-21 | 신청서 + 본 패키지 zip 제출 |
| D-14 ~ D-7 | 담당자 배정 + 회의 일정 협의 |
| D-3 ~ D-0 | 회의 자료 발표용 deck 작성 (별도, 본 패키지 §3 + §4 요약 기반) |
| D-day | 회의 (1~2시간 권장) |
| D+1 ~ D+14 | 회신 정리 + 본 패키지 §6 의사결정 트리거 실행 |

## 6. 회의 당일 체크리스트 (v1.0 신규)

### 6.1 준비물

- [ ] 본 패키지 인쇄본 (A4 양면, 약 30~40쪽)
- [ ] 회의 자료 발표용 deck (15~20장, 본 패키지 §3 + §4 + §1 Q1~Q6 요약)
- [ ] 노트북 + 데모 환경 (필요 시 V&V `npm run test:vnv` 실행 가능 환경)
- [ ] 신청기업 사업자등록증 + 대표자 신분증
- [ ] 명함

### 6.2 회의 진행 권장 순서

1. (5분) 회사 + 제품 한 페이지 소개
2. (10분) 사용목적·작용원리·5채널 멀티모달 (본 패키지 §3.1~§3.4)
3. (10분) 자체 V&V + 사이버보안 + AI 평가 체계 (본 패키지 §6~§8)
4. (10분) RM v1.0 + IEC 62366 + IEC 62304 산출물 (본 패키지 §5 + §9 + §6)
5. (15분) Q1~Q6 질의 + 식약처 답변
6. (5분) 후속 일정 합의

### 6.3 답변 받아야 할 핵심 결정 (회의 당일 가능한 질문)

- 품목분류 사전 의견 (Q1)
- DTx 동시 신청 vs 후속 (Q2)
- 임상시험 면제 가능성 (Q4)
- 사용성평가 위탁 vs 자체 (Q6)
- (선택) 부산대 / 서울 Big5 PI 후보 권고

## 7. 회신 후 의사결정 트리거 (v1.0 신규)

식약처 회신에 따라 다음 산출물을 동시 갱신해야 한다 (cross-reference 절단 방지).

| 회신 결과 | 갱신 대상 산출물 |
|---|---|
| 품목분류 / 등급 변경 권고 | `digital-medical-product-gap-matrix.md` §1-2, `risk-management-file.md` §3, `regulatory-completion-status.md` §1 |
| DTx 동시 신청 권장 | `claim-lock.md` §3 디지털치료기기 표현 승격, `mfds-guideline-gap-analysis.md` §4-2 시나리오 B 우선, `clinical/dtx-rct-protocol-skeleton.md` 일정 가속 |
| 사용목적 표현 수정 | `claim-lock.md` §6 치환표 추가, `intended-use-and-contraindications.md` §1, 사용자 매뉴얼 3종 §1 |
| 임상시험 필수 판정 | `mfds-guideline-gap-analysis.md` §3-3 일정 정정, `clinical/dtx-rct-protocol-skeleton.md` 즉시 v1.0 작업 |
| AI 변경관리 빈도 권고 | `change-approval-sop.md` §4, `post-market-surveillance-plan.md` §3 |
| 위탁시험기관 권고 명단 | `usability-test-rfp.md` 신규 (옵션 B 작업) |
| 사이버보안 추가 요구사항 | `cve-exemptions.md`, `cybersecurity-final-readiness-report.md`, 사이버보안 35 항목 일치도 갱신 |

## 8. cross-reference 4개 동시 갱신 의무

본 패키지 v1.0 출판 시 다음 4 문서 동시 갱신 (claim-lock 의 cross-reference 룰):

- `claim-lock.md` v0.3.0 — 본 패키지 §1 Q3 답변에 따라 §3·§4·§5 갱신 가능
- `risk-management-file.md` v1.0 — 본 패키지 §1 Q1 답변에 따라 §3 등급 재평가 가능
- `spec-gap-roadmap.md` Q 엔트리 — 본 패키지 v1.0 출판을 명시
- `regulatory-completion-status.md` v0.1 — §4 mfds-pre-consultation-pack 행을 v1.0 으로 마킹

## 9. 갱신 이력

- 2026-04-30 v0.1: 초안. 6 질의 + 13 산출물 분류 + 핵심 본문 3 발췌 + 양적 요약.
- 2026-04-30: v1.1 (사용 환경 9개 확장) 작업 후 PM 결정으로 **전체 롤백** (v1.0 유지). 이미지 자산·임상가 PROTOCOL 정식화 전엔 6개 환경만 정합성 있게 운영.
- 2026-04-30 v1.0: **사전상담 즉시 신청 가능 상태로 보강.**
  - 양적 수치 갱신 (V&V 49→53 TC, SR 31→35, 추적성 47→51 행)
  - claim-lock v0.2.5 → v0.3.0 reference, RM v0.3 → v1.0 reference
  - §1 각 질의에 "근거 산출물 + 후속 의사결정 트리거" 추가
  - §5 사전상담 신청 절차 (경로 / 양식 / 비용 / 일정) 신규
  - §6 회의 당일 체크리스트 (준비물 / 진행 순서 / 핵심 답변 결정) 신규
  - §7 회신 후 의사결정 트리거 (산출물별 갱신 대상 매트릭스) 신규
  - §8 cross-reference 4개 동시 갱신 의무 명시
  - §3.4 RM v1.0 위험통제 핵심 발췌 신규
  - §2 산출물 인덱스에 사용자 매뉴얼 3종 + SRS/SDS/traceability 분류 M·E.3 추가
