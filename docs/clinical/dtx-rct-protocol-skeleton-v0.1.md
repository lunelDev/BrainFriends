# 브레인프렌즈 DTx 임상시험 프로토콜 (뼈대 초안) v0.1

> **상태**: 내부 초안 (draft skeleton). 본 문서는 ICH E6(R2) GCP 형식을 차용한 뼈대이며, 실제 시험 개시 전 **PI, 통계 자문가, 임상시험심사위원회(IRB), 식약처 사전상담**을 통한 확정본 작성이 필수이다. 표본 수·일정·예산 등 수치는 "**추정**" 표시가 붙은 경우 실증 데이터 없이 가정된 값이다.

---

## 1. 시험 기본 정보

| 항목 | 내용 |
|---|---|
| 시험명 (국문) | 실어증 환자에서 브레인프렌즈 디지털치료기기의 유효성·안전성을 평가하기 위한 무작위배정, 이중눈가림, 가대조군, 다기관, 제3상(확증) 임상시험 |
| 시험명 (영문) | A Randomized, Double-blind, Sham-controlled, Multi-center, Phase III Trial to Evaluate the Efficacy and Safety of BrainFriends Digital Therapeutic (DTx) in Patients with Aphasia |
| 프로토콜 번호 | BF-DTx-APH-301 (추정) |
| 버전·날짜 | v0.1 / 2026-04-24 |
| 후원자 | (주)골든브레인케어 |
| 시험책임자 (PI) | [미정 — 국내 주요 재활의학/신경과 교수 1인] |
| CRO | [미정 — 국내 CRO 2~3개 대상 RFP 예정] |
| IRB 승인 번호 | [향후 — 기관별] |
| 식약처 임상시험계획승인 (IND) | [향후 — 프로토콜 확정 후] |
| 연락처 | clinical@goldenbraincare.co.kr (추정) |

---

## 2. 시험 배경 및 근거

### 2.1 실어증 역학
- 실어증은 뇌졸중 후 흔한 후유증으로, **뇌졸중 환자의 약 21~38%** 에서 급성기에 나타남 (Engelter et al., 2006; Dickey et al., 2010).
- 국내 뇌졸중 연간 발생: 약 10만 명 내외 (질병관리청 통계). 이 중 **실어증 신규 발생은 연간 약 2~4만 명 추정** (국내 역학 연구 인용 필요 — 대한뇌졸중학회 자료 확인 예정).
- 만성기로 이행하며 6개월 이상 지속되는 만성 실어증 환자 누적 풀은 수십만 명 수준으로 추정.

> ⚠️ "연간 5만 명 신규"는 추정 수치이며, 최종 프로토콜에서는 질병관리청·건강보험심사평가원 최신 데이터로 교체 필요.

### 2.2 기존 재활의 한계
1. **접근성**: 언어치료 전문 인력이 수도권·대형병원에 편중. 지방 중소병원은 세션 확보 어려움.
2. **비용**: 회당 5~10만원, 주 2~3회 권장 → 가계 부담.
3. **표준화**: 치료사별 편차. 객관적 정량 지표 부족.
4. **강도**: 뇌졸중 재활 근거상 고강도·고빈도가 효과적이나 (Bhogal et al., 2003 — 주 최소 5시간 이상), 대면 치료로는 현실적 제약.

### 2.3 디지털치료기기의 이론적 근거
- 신경가소성(neuroplasticity) 기반 반복 과제: 실어증 재활은 **과제 강도·반복**이 회복과 강한 상관 (Brady et al., 2016 Cochrane review; PMID: 27245310).
- 원격·자가 훈련으로 일일 노출 시간 증가 → 가소성 촉진.
- 객관적 음향 지표(acoustic features) 기반 피드백 → 자기조절 학습.
- 선행 DTx 근거: Constant Therapy (Des Roches et al., 2015; PMID: 25941483), Aphasia.com — 자가 디지털 훈련이 AQ·naming accuracy 개선에 유의함을 보고.

### 2.4 브레인프렌즈 작용기전 가설
브레인프렌즈 DTx 는 다음 요소 조합을 통해 언어기능 회복을 촉진한다는 가설에 기반한다.
1. **단계별 과제(Step 1~6)**: 음소 → 음절 → 단어 → 구 → 문장 → 담화로 위계적 난이도 조절 (Therapy Outcome Measures; SLT 표준 모델 참고).
2. **실시간 음향 피드백(REQ-001~012, 020/021)**: Parselmouth 기반 F0, jitter, shimmer, 자음·모음 정확도 지표를 즉시 제공 → 조음 재학습.
3. **적응형 난이도 조절**: 수행 점수에 따라 다음 세션 난이도 자동 조정 (Zipfian 분포 보정 예정).
4. **세션 간격·총량 최적화**: 주 5회 × 30분 × 12주 설계 → 총 약 30시간, 권장 재활 강도 충족.

### 2.5 선행 연구 요약 (최소 5편 인용 예정 — v0.2 에서 full citation)
1. Brady MC et al., 2016. *Speech and language therapy for aphasia following stroke*. Cochrane Database. PMID: 27245310.
2. Des Roches CA et al., 2015. *Effectiveness of an impairment-based individualized rehabilitation program using an iPad-based software platform*. Frontiers in Human Neuroscience. PMID: 25941483.
3. Palmer R et al., 2019. *Self-managed, computerised speech and language therapy for patients with chronic aphasia post-stroke (Big CACTUS): a multicentre, single-blinded, randomised controlled trial*. Lancet Neurology. PMID: 31174994.
4. Kurland J et al., 2018. *iPractice: piloting the effectiveness of a tablet-based home practice program in aphasia treatment*. Seminars in Speech and Language. PMID: 29359306.
5. Kim H et al., [한국어 실어증 AQ 재검사 신뢰도 연구 — 실제 PMID 추가 검증 필요].

> 창작 주의: 위 PMID 는 실제 존재하는 것으로 알려진 논문이나, **v0.2 에서 PubMed 직접 확인 후 인용 확정 필요** (DOI, authors, journal, year 정합성).

---

## 3. 시험 목적

### 3.1 1차 목적
- 실어증 환자가 브레인프렌즈 DTx 를 **12주 간 주 5회·회당 30분** 사용 시 **K-WAB AQ (Korean-Western Aphasia Battery, Aphasia Quotient)** 점수의 baseline 대비 유의한 개선을 입증한다 (sham 대조군 대비 우월성).

### 3.2 2차 목적
- 자음 정확도(Percentage of Consonants Correct, PCC) 및 모음 정확도(PVC) 의 개선
- 유창성(CATV: Connected Speech Analysis Test for Verbal fluency 등) 개선
- 삶의 질(SAQOL-39K: Stroke and Aphasia Quality of Life Scale 한국어판) 개선
- 환자·보호자 만족도 (자체 설문)

### 3.3 탐색적 목적
- Parselmouth 기반 음향 지표 (F0 mean/SD, jitter local/rap, shimmer local/apq, HNR, MFCC) 와 K-WAB AQ 변화량 간 상관관계 분석
- 중증도·실어증 유형별 반응 차이 (부그룹 분석)
- 사용 빈도(adherence) 와 효과 간 용량-반응 관계

### 3.4 안전성 목적
- 기기 관련 이상반응 (심리적 스트레스, 피로, 시청각 불편) 빈도·중증도 평가

---

## 4. 시험 설계

| 항목 | 내용 |
|---|---|
| 설계 | Prospective, Randomized, Double-blind, Sham-controlled, Parallel-group, Multi-center, Phase III |
| 군 배정 | 1:1 — 시험군(BrainFriends active) vs 대조군(sham app) |
| 눈가림 | 이중눈가림 (참여자 · 평가자). 스폰서·통계가는 key 해제 전까지 단일 눈가림. |
| 다기관 | 최소 2곳, 권장 3~4곳 (예: 상급종합병원 2곳 + 재활전문병원 1~2곳) |
| 기간 | 모집 6개월 + 개입 12주 + 추적 12주 = **총 약 9~12개월** 개별 참여 기간, 시험 전체 약 **18~24개월** |
| 대조군 설계 | **Sham app**: 시험군과 UI·과제 구조 동일. 단, (a) 음향 피드백·정량 점수 미제공 (b) 적응형 난이도 조정 없음 (c) 고정 콘텐츠. 사용자 기대·참여감은 유지하도록 외형·소리 효과 유지. |
| 무작위 배정 | Permuted block randomization (block size 4 또는 6, 중앙 무작위 시스템 IWRS). 층화(stratification) 변수: (1) 기관 (2) 중증도(AQ 30~50 vs 50~80) (3) 실어증 유형(유창형 vs 비유창형). |

### 4.1 Sham 설계 근거 및 윤리
- 사용자의 "치료받고 있다"는 기대감 통제 (placebo 효과 제거)
- 참여자는 시험 종료 후 원할 경우 active 버전 무상 제공 (wait-list open-label extension)
- 모든 참여자는 **표준 치료(기존 언어치료)는 계속 유지** — add-on 설계이므로 기존 치료 접근성 박탈 없음

---

## 5. 대상자

### 5.1 선정 기준 (Inclusion)
1. 성인: **19~80세** (한국 성인 기준)
2. 뇌졸중(허혈성 또는 출혈성) 후 **3개월 이상 24개월 이하** 경과 (급성기 자연 회복 제외 + 만성화 전 개입)
3. K-WAB AQ **30~80점** (경도 ~ 중등도; severe < 30 은 반응성 저하, normal > 80 은 천장효과)
4. K-MMSE **≥ 18** (동의 및 앱 사용 가능 수준 인지기능)
5. 한국어 모국어 화자
6. 시청각 기능이 앱 사용 가능 수준 (교정 시력 0.5 이상, 청력 40 dB HL 이하)
7. 본인 또는 법정대리인의 서면 동의

### 5.2 제외 기준 (Exclusion)
1. 심각한 인지장애 (K-MMSE < 18) 또는 진행성 신경퇴행질환 (알츠하이머·파킨슨 등)
2. 중증 디스아트리아 단독 (언어기능은 보존 — 대상군 다름)
3. 우울증·정신증 활성기 (BDI-II ≥ 29 또는 정신과 의사 판단)
4. 교정 불가능한 시청각 장애
5. 임신·수유 (피해 가능성은 낮으나 일반적 제외)
6. 지난 1개월 내 다른 중재적 임상시험 참여
7. 상지 마비로 태블릿 조작 절대 불가 (보호자 보조 가능 시 포함 검토)
8. 알코올·약물 남용 현재 진행

### 5.3 목표 등록 수 (표본 크기)
- **총 120명** (시험군 60명 + 대조군 60명) — **추정**
- **근거**:
  - 1차 endpoint: K-WAB AQ 12주 변화량 군간 차이
  - 효과크기 **Cohen's d = 0.5** 가정 (중간 효과, Cochrane 리뷰 기반)
  - 파워 80%, 양측 α = 0.05, 1:1 배정 → 군당 64명 (G*Power 3.1 계산)
  - 중도 탈락 20% 고려 → 군당 80명 (보수적 시) / 군당 60명 (낙관적 시)
- **최종 표본 수는 통계 자문 후 재산정** (v0.2 에서 확정)

### 5.4 중도 탈락 허용 및 대체
- **허용 탈락률**: 20% 이내
- 사유별 기록: 자발 철회 / 부작용 / 프로토콜 불이행 / 소실 / 기타
- 대체 등록 여부: **하지 않음** (ITT 원칙 유지)

---

## 6. 개입 (Intervention)

### 6.1 시험군 (Active BrainFriends DTx)
- 기기: 제공 태블릿 (iPad 9세대 이상 또는 동등, 제공) + 표준 헤드셋
- 소프트웨어 버전 고정: `release_version`, `algorithm_version`, `catalog_version` (DB 스키마 기 반영)
- 사용 스케줄: **주 5회, 회당 30분, 12주 (총 60세션, 약 30시간)**
- 세션 구성: Step 1~6 중 적응형 선택, 음향 피드백 + 정량 점수 표시
- 자가 훈련 + 주 1회 원격 CRC 모니터링 (adherence 확인)

### 6.2 대조군 (Sham)
- 동일 하드웨어·사용 스케줄
- 앱은 외형·과제 동일하되 피드백·측정·적응형 조정 없음
- 동일한 CRC 접촉 빈도 (attention control)

### 6.3 병용 치료
- **기존 표준 언어치료 유지 허용** (add-on 설계): 양군 모두 시험 기간 중 동일 강도의 기존 치료 계속.
- **치료 강도 기록**: 기존 세션 주당 시간을 매주 CRC 가 기록.
- **신규 치료 금지**: 등록 후 새로운 언어재활 프로그램(타 DTx, 특수 집단 치료 등) 시작은 프로토콜 편차.
- 약물(경구 도네페질, SSRIs 등 보조적 처방) 은 등록 30일 전부터 용량 변동 없는 경우만 허용.

### 6.4 중단 기준 (개별)
- 참여자 요청
- 신규 뇌졸중·주요 심혈관 사건
- 임상적으로 유의한 악화 (PI 판단)
- 지속적 프로토콜 불이행 (adherence < 50% 4주 연속)

---

## 7. 평가 시점 및 절차 (Schedule of Assessments)

| 시점 | 명칭 | 시기 | 주요 평가 |
|---|---|---|---|
| T0 | Screening | –14일 ~ 0일 | 동의·적격성·기초 기록·Demographics·의학사 |
| T1 | Baseline | 0일 (무작위 직전) | K-WAB AQ(전체), K-MMSE, SAQOL-39K, 음향 baseline 녹음 |
| T2 | Interim | 6주차 (±3일) | K-WAB AQ 축약형 (Bedside WAB), 앱 adherence 로그 수집 |
| T3 | **Primary endpoint** | 12주차 (±5일) | K-WAB AQ 전체, PCC/PVC, CATV, SAQOL-39K, 환자 만족도, AE 전수 조사 |
| T4 | Follow-up | 24주차 (±7일) | K-WAB AQ 전체, SAQOL-39K, 효과 유지 확인, 자발적 훈련 빈도 |

### 7.1 평가 도구
- **K-WAB (Paradise Korean-Western Aphasia Battery)** — 김향희·나덕렬 표준화, AQ 도출
- **K-MMSE** — 선별/제외 판정
- **SAQOL-39K** — 삶의 질 (한국판 타당도 있는 버전 선정 확인 필요)
- **CATV** — 유창성 측정
- **자체 개발 환자 만족도 설문** — 5-point Likert, 10문항 (v0.2 에서 내용 확정)
- **Parselmouth 기반 음향 지표** — REQ-001~012, 020/021 출력값 자동 수집

### 7.2 Endpoint Adjudication
- K-WAB 평가는 **앱 개발 및 치료와 독립된 언어재활사 2인** 이 독립 채점, 불일치 시 3인 중재.
- 평가자는 군 배정을 모름 (blinded assessor).

---

## 8. 평가 변수 (Endpoints)

### 8.1 1차 평가 변수
- **K-WAB AQ 변화량 (T3 – T1)**: 군간 평균 차이

### 8.2 2차 평가 변수
- K-WAB AQ 변화량 (T4 – T1) — 효과 유지
- PCC, PVC (T3 – T1)
- CATV 단위 시간당 정보 단위 (CIU) 변화
- SAQOL-39K 총점 및 하위도메인 변화
- 환자 만족도 점수
- Adherence (목표 대비 실제 세션 완료율)

### 8.3 탐색적 변수
- 음향 지표 (F0 SD, jitter local, shimmer local, HNR) 의 변화 및 AQ 와의 상관
- 부그룹별 반응 차이 (중증도·유형·연령·발병 후 경과)

### 8.4 안전성 변수
- 이상반응(AE) / 중대한 이상반응(SAE) 빈도, 중증도(CTCAE 5.0 기반 수정 — 언어재활용), 기기 관련성 판정
- 예상 AE: 피로감, 눈·목 통증, 좌절감·우울감 악화, 헤드셋 관련 피부자극
- 예상 SAE: 거의 없음 (DTx 특성상)

---

## 9. 통계 분석

### 9.1 분석 세트
- **ITT (Intention-to-Treat)**: 무작위 배정된 전체. 1차 분석.
- **PP (Per-Protocol)**: adherence ≥ 80%, 주요 프로토콜 편차 없음. 민감도 분석.
- **Safety Set**: 최소 1회 이상 개입 노출된 참여자.

### 9.2 1차 분석
- **Primary model**: Mixed Model for Repeated Measures (MMRM)
  - 종속변수: K-WAB AQ
  - 고정효과: treatment, time, treatment × time, baseline AQ, 층화 변수(기관·중증도·유형)
  - 임의효과: 참여자 (intercept)
  - 공분산 구조: unstructured (기본), compound symmetric (fallback)
- **주 귀무가설**: 12주차 AQ 변화량 군간 차이 = 0
- **검정**: 양측 α = 0.05, 95% 신뢰구간 제시
- **다중 비교 보정**: 2차 endpoint 는 계층적 testing procedure 적용 (1차 유의 시 순차 검정)

### 9.3 표본 크기 재계산 근거
- 효과크기 0.5, SD 12 (기존 AQ 변화 연구 기반 추정), 파워 80%, α 0.05 양측 → 군당 약 64명
- 20% 탈락 고려 → 군당 80명 (보수) / 군당 60명 (타당성 감안 등록)
- **PI 및 통계 자문가와 v0.2 에서 확정**

### 9.4 부그룹 분석 (사전 정의)
- 중증도: AQ 30~50 (중등도~중증) vs 50~80 (경도~중등도)
- 실어증 유형: 유창형 (Wernicke, Anomic, Conduction) vs 비유창형 (Broca, Global, Transcortical motor)
- 연령: 19~49 vs 50~64 vs 65~80
- 발병 후 경과: 3~6개월 vs 6~12개월 vs 12~24개월

### 9.5 결측치 처리
- 주 분석 (MMRM) 은 MAR 가정 하 유효
- 민감도 분석: Multiple Imputation (m=20, FCS with MNAR pattern-mixture)
- Tipping-point 분석: 결론이 뒤집히는 결측 편향 크기 탐색

### 9.6 중간 분석
- 6주차 효능 중간 분석은 수행하지 않음 (탐색적 목적만)
- 안전성 중간 분석: 등록 50%, 100% 시점에 DSMB 검토

---

## 10. 윤리 고려

### 10.1 IRB 승인
- 모든 참여 기관 IRB 승인 후 등록 개시
- 프로토콜 amendment 시 IRB 재승인 (긴급 안전 조치 예외)

### 10.2 동의
- Task #76 IRB 데이터 수집 프로토콜 §4 참조
- 가족 대리 동의 기준: AQ < 50 또는 K-MMSE < 24

### 10.3 개인정보 보호
- Task #76 §6 참조 (암호화·RBAC·감사로그·가명화)

### 10.4 Data and Safety Monitoring Board (DSMB)
- **권장 구성**: 독립 신경과·재활의학·통계·윤리 전문가 최소 3~5인
- **역할**: 등록 25%·50%·75% 시점 안전성 검토, 조기 중단 권고
- **조기 중단 기준**:
  - 예상 외 SAE 빈도 > 5%
  - 중증 심리적 부작용 clustering
  - futility (조건부 파워 < 20%)

### 10.5 시험 중단 기준 (전체)
- 식약처·IRB 권고
- DSMB 권고
- 후원자 재정·기술 사유 (윤리 서약: 참여자 안전 우선)

### 10.6 이해상충
- 후원자는 (주)골든브레인케어 (기기 제조사) — 전체 PI·Co-I·분석가의 COI 사전 공개
- 통계 분석은 CRO 독립 수행, 후원자는 결과 열람만 (수정 권한 없음)

---

## 11. 일정 (Timeline)

| 단계 | 기간 | 비고 |
|---|---|---|
| 프로토콜 v0.1 → v1.0 확정 | 1~2개월 | PI·통계·IRB·식약처 사전상담 반영 |
| IRB 제출 ~ 승인 | 2~3개월 | 기관별 순차 또는 병렬 |
| 식약처 임상시험계획승인 (IND) | 병행 2~3개월 | DTx 가이드라인 경로 |
| 시험 개시 (First Patient In, FPI) | 시작 후 4~6개월 | |
| 모집 완료 (Last Patient In, LPI) | FPI + 6~9개월 | 월 평균 15~20명 추정 |
| 마지막 참여자 T3 (Primary endpoint) | LPI + 3개월 | |
| 마지막 참여자 T4 (Follow-up 종료) | LPI + 6개월 | |
| Database lock | T4 종료 + 1~2개월 | |
| Statistical report / CSR | DB lock + 2~3개월 | |
| 결과 공개·논문 투고 | CSR + 3개월 | |
| **총 기간** | 약 **21~24개월** | |

---

## 12. 예산 추정 (Budget Estimate)

> 본 수치는 모두 **추정** 이며, CRO RFP 및 기관 단가 확정 후 재산정.

| 항목 | 추정 금액 (억원) | 비고 |
|---|---|---|
| 참여자 등록·보상·교통비 | 0.3~0.5 | 120명 × 약 30~50만원 (교통·시간 보상) |
| PI·Co-I·CRC 인건비 | 0.6~1.0 | 기관당 PI 연 3천만, CRC 1인 전담 |
| 통계 자문·CRO 비용 | 0.5~1.0 | 프로토콜·SAP·DB·분석·모니터링 |
| 기기 (태블릿·헤드셋) | 0.1~0.2 | 120대 × 약 100만원 |
| 인프라 (서버·스토리지·보안) | 0.15~0.3 | 2년 운영 |
| 모니터링·감사 | 0.2~0.4 | 분기 방문, on-site SDV 10~20% |
| 보험 (피험자 배상) | 0.05~0.1 | 1인당 약 5만원 수준 |
| 중앙 평가자·라벨링 | 0.1~0.2 | 언어재활사 전사·IAA |
| IRB 심의비·IND 수수료 | 0.05~0.1 | 기관별 |
| 학회 발표·논문 투고 | 0.05~0.1 | |
| 예비비 (10%) | 0.2~0.4 | |
| **총 추정** | **2.3~4.3 억원** | 보수적 시 최대 5억까지 계획 |

---

## 13. 참고 문헌 (v0.2 에서 full APA/Vancouver 인용 확정)

1. Brady MC, Kelly H, Godwin J, Enderby P, Campbell P. Speech and language therapy for aphasia following stroke. *Cochrane Database Syst Rev*. 2016;(6):CD000425. PMID: 27245310.
2. Des Roches CA, Balachandran I, Ascenso EM, Tripodis Y, Kiran S. Effectiveness of an impairment-based individualized rehabilitation program using an iPad-based software platform. *Front Hum Neurosci*. 2015;8:1015. PMID: 25941483.
3. Palmer R, Dimairo M, Cooper C, et al. Self-managed, computerised speech and language therapy for patients with chronic aphasia post-stroke (Big CACTUS): a multicentre, single-blinded, randomised controlled trial. *Lancet Neurol*. 2019;18(9):821-833. PMID: 31174994.
4. Kurland J, Wilkins AR, Stokes P. iPractice: Piloting the Effectiveness of a Tablet-Based Home Practice Program in Aphasia Treatment. *Semin Speech Lang*. 2014;35(1):51-63. PMID: 29359306 (재확인).
5. Engelter ST, Gostynski M, Papa S, et al. Epidemiology of aphasia attributable to first ischemic stroke. *Stroke*. 2006;37(6):1379-1384.
6. Dickey L, Kagan A, Lindsay MP, Fang J, Rowland A, Black S. Incidence and profile of inpatient stroke-induced aphasia in Ontario, Canada. *Arch Phys Med Rehabil*. 2010;91(2):196-202.
7. Bhogal SK, Teasell R, Speechley M. Intensity of aphasia therapy, impact on recovery. *Stroke*. 2003;34(4):987-993.
8. 김향희, 나덕렬. 파라다이스·한국판 웨스턴 실어증 검사. 파라다이스복지재단, 2001 (개정판 확인).
9. MFDS. 디지털치료기기 허가·심사 가이드라인. 식품의약품안전처, 2020-12 (현행본으로 업데이트 필요 — PDF #7).
10. ICH Harmonised Guideline E6(R2) — Good Clinical Practice. ICH, 2016.

> ⚠️ PMID·년도·저자·저널은 **v0.2 에서 PubMed/KISS 직접 재확인**. 본 v0.1 은 초안이므로 일부 서지 정보는 재검증 전.

---

## 14. 변경 이력

| 버전 | 날짜 | 변경 내용 | 작성 |
|---|---|---|---|
| v0.1 | 2026-04-24 | 뼈대 초안 작성 (Task #81) | 임상 TF |

## 15. 검토 요청 사항 (v0.2 를 위해)

본 v0.1 은 뼈대 초안이며, 실제 IND/IRB 제출본을 위해 다음 전문가 검토가 필요하다.

- [ ] **의학적 검토**: 재활의학 또는 신경과 PI (선정/제외 기준, 중단 기준, AE 예상)
- [ ] **언어병리학 검토**: 언어재활사 1급 + K-WAB 표준화 관여 전문가 (평가 도구, 라벨링)
- [ ] **통계 자문**: 표본 크기, MMRM 모델, 결측치 처리, 중간 분석
- [ ] **윤리·법률**: IRB 사무국, CPO (동의, 개인정보, 보상)
- [ ] **식약처 사전상담**: DTx 가이드라인 요구사항 충족 확인 (PDF #7)
- [ ] **CRO 선정 및 견적**: 예산 및 일정 재산정
- [ ] **기관 IRB 사전 미팅**: 서울대·연세대·분당서울대 등 후보 기관
- [ ] **DSMB 위원 섭외**: 독립 3~5인

> ⚠️ **본 v0.1 은 내부 설계·자금 유치·파트너 섭외용 초안이며, 제출용 아님.** v1.0 확정 전 반드시 위 검토 완료.
