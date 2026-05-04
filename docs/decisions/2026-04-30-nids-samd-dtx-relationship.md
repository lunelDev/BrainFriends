# NIDS 답변 — SaMD 와 DTx 의 관계

작성일: 2026-04-30
작성: 골든브레인케어 PM
근거: 한국의료기기안전정보원(NIDS) 답변
관련 문서:
- `docs/regulatory/digital-medical-product-gap-matrix.md`
- `docs/remediation/00-summary/mfds-guideline-gap-analysis.md`
- 식약처 가이드라인 PDF #6 (디지털의료기기소프트웨어), PDF #7 (디지털치료기기)

## 결정

브레인프렌즈는 **SaMD 골격을 무조건 갖추고**, DTx 분류 인정은 **임상 자료 강도에 따라 식약처가 신청 자료를 보고 판단**한다. 양자택일 의사결정이 아니다.

## 근거 — NIDS 답변 요지

> "SaMD 안에 DTx 가 들어있다."

즉 분류 관계는 다음과 같다.

```
디지털의료기기소프트웨어 (SaMD, PDF #6)
  ├── 정보제공·관리형 SaMD
  ├── DTx (PDF #7) — SaMD 의 부분집합
  └── (그 외 분류)
```

식약처 PDF #7 §II "DTx 판단 흐름도" 도 동일한 구조이다.
1. 독립형 SaMD 인가
2. 질병 예방·관리·치료를 제공하는가
3. 치료 작용기전의 과학적 근거가 있는가

→ 3개 동시 충족 시 DTx, 아니면 SaMD 의 다른 분류 (정보제공·관리 등).

## 종전 gap-matrix 가정의 정정

### 잘못된 표현

`docs/regulatory/digital-medical-product-gap-matrix.md`

- §4-2 "분기 시나리오 A/B/C/D" 가 SaMD vs DTx 를 **양자택일** 로 묘사
- §6 첫 번째 의사결정 "DTx 트랙 vs SaMD 트랙" 도 같은 오해

`docs/remediation/00-summary/mfds-guideline-gap-analysis.md`

- §4-3 "최적 분류 전략 제안" 의 "1순위 시나리오 A vs 2순위 백업 시나리오 B" 표현이 양자택일로 읽힘

### 정정된 PM 판단

- 1차 신청: **SaMD 신청서 (PDF #6 13개 섹션 + [별표3])** 무조건 작성
- DTx 인정: 1차 신청에 DTx 첨부자료 (PDF #7 §III.2 8종) 함께 제출하거나, 1차 SaMD 허가 후 변경허가로 추가 신청 가능
- 임상시험 (전향적): DTx 분류 인정을 받기 위한 **자료 강도 결정 요인**이지, 1차 SaMD 허가의 전제 조건이 아니다

## 운영 영향

### 이전 의사결정 (이제 폐기)

`gap-matrix §6` 첫 번째 의사결정 "DTx 트랙을 갈 것인가, SaMD '정보제공·관리' 트랙으로 갈 것인가?" → **이 의사결정 자체가 사라진다.**

### 새 PM 권장 동선

1. SaMD 14종 즉시 항목 (gap-matrix §3-1) 작업 — 무조건 진행
2. 부산대 / 서울 Big 5 콜드메일 (`pi-candidate-list-and-outreach.md`) — DTx 분류 인정 자료용 RCT 준비. 1차 허가 의존성은 끊긴다
3. 1차 SaMD 신청 자료 완성 후 DTx 첨부자료 추가 검토 — 임상자료 강도가 충분하면 함께 제출, 부족하면 1차는 SaMD 정보제공·관리 형태로 신청 후 후속 변경허가

### 2개 남은 주요 의사결정 (gap-matrix §6 의 2번·3번은 그대로 유효)

1. **Whisper STT 를 "AI 구성요소" vs "외부 음성 전사 API" 로 기재할 것인지** — gap-matrix §6 의 2번. 변동 없음
2. **GMP 자체 구축 vs 외주 QMS 컨설팅** — gap-matrix §6 의 3번. 변동 없음

## 코드 영향

### 변동 없음

- 시선·AAC·V&V·사이버보안·STT 정책 등 진행 중인 기능 작업
- 이미 완성된 gazeAccumulator / AACBoard / runDeterministicChecks 의 구조

### 영향 받는 표현

- `docs/remediation/00-summary/spec-gap-roadmap.md` 의 P0-3 (WASM-STT) 의사결정 — Whisper 표현 (위 의사결정 1번) 과 함께 정리 필요. 단 NIDS 답변과는 직접 관계 없음
- 제품제안서·소개자료의 "DTx" 표현 — "SaMD (DTx 분류 신청 검토 중)" 또는 "SaMD" 단독 으로 표현 통일

## 갱신 이력

- 2026-04-30: 초안. NIDS 답변 직후 즉시 결정문화. gap-matrix 와 mfds-guideline-gap-analysis 의 분기 시나리오 표현 정정 트리거.
