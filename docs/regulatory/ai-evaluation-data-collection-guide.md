# AI STT 성능평가 데이터 수집 가이드 v0.1

작성일: 2026-04-30
근거: 식약처 AI 적용 디지털의료기기 가이드라인 PDF #2 §III.2 성능 검증
관련: `werRunner.ts` (`SR-AI-EVAL-RUNNER`), `sttBenchmark.ts` (`SR-AI-RTF-RUNNER`), `cloud-and-data-transfer.md`
대상: 임상 협력기관 (부산대병원 등) 의 데이터 수집 담당자 / 골든브레인케어 PM

## 1. 목적

claim-lock §4 "WER 15% 이하" 정량 클레임을 §3 사용 가능 클레임으로 승격하기 위해 필요한 한국어 실어증·마비말장애 음성 30~50건의 수집 SOP 와 CSV 양식을 정의한다.

본 문서는 데이터 수집 가이드이다. 평가 결과는 `npm run ai-eval:wer` + `npm run ai-eval:rtf` 로 자동 산출되어 `docs/regulatory/ai-evaluation-runs/<timestamp>/report.{json,md}` 에 저장한다.

## 2. 모집 대상 (claim-lock §4 → §3 승격 조건)

| 변수 | 분포 목표 |
| --- | --- |
| 연령 | 60s 10건 / 70s 12건 / 80s 8건 = 30건 (claim-lock 80s passRateAt15 ≥ 0.65 검증) |
| 진단 | 실어증 (브로카 / 베르니케 / 전반 / 명칭) 20건 + 마비말장애 (경증 / 중등도 / 중증) 10건 |
| 성별 | 남 15 + 여 15 |
| 발병 후 경과 | 급성기 (< 6주) 제외, 만성기 (> 3개월) |

**제외 기준**: 응급·급성기 환자, 인지기능 저하로 동의 어려운 환자, MCI/치매 진단자 (1차 허가 범위 외)

## 3. 수집 절차 SOP

### 3.1 사전 준비

1. IRB 또는 위탁시험기관 승인 (별도 평가시 본 평가의 IRB 적용 가능 — `usability-evaluation-irb-package.md` 참조)
2. 동의서 + 모집공고문 (위 IRB 패키지 §3, §4 참조)
3. 녹음 환경 표준화: 외래 클리닉 정숙 환경 (배경 소음 < 40 dB), 마이크 30cm 거리
4. 자극어 목록 (별첨 A): K-WAB 자극어 + 일상 발화 + 조음장애 진단 단어 = 30 자극어

### 3.2 환자별 녹음 절차

1. 동의서 서명 + 가명 ID 부여 (P001 ~ P030)
2. 환경 정보 기록: device_type (어떤 마이크), noise (배경 소음 추정 low/mid/high), lighting (일관성 위해)
3. 30 자극어 발화 녹음 (각 1회, 무음 구간 제외 평균 2~3 초)
4. 사람 전사 (ground_truth) 작성: 임상가 1인 + 검증자 1인 (불일치 시 합의)
5. STT 결과 (transcript) 수집:
   - 현재 허가 기준 기본값: 서버 보안 프록시 STT (`/api/proxy/stt`) 응답
   - 후보/비교용 로컬 엔진이 도입되는 경우: 별도 모델명과 버전을 기록하고 서버 STT와 분리 평가
6. RTF 측정 (선택): processingMs 측정 후 sample-rtf-fixture.csv 양식으로 별도 기록

### 3.3 자극어 목록 (별첨 A — 30 단어)

```
1. 사과    11. 안녕하세요  21. 화장실 어디예요
2. 학교    12. 감사합니다  22. 점심 먹었어요
3. 텔레비전 13. 배가 고파요  23. 약 먹어야 해요
4. 도서관  14. 물 좀 주세요 24. 잠을 잘 못 잤어요
5. 자전거  15. 화장실 가요  25. 가족이 보고 싶어요
6. 우산    16. 도와주세요   26. 운동을 하고 싶어요
7. 바나나  17. 너무 힘들어요 27. 오늘 날씨가 좋네요
8. 비행기  18. 잠깐 쉬고 싶어요 28. 약속 시간이 늦었어요
9. 시계    19. 오늘 기분이 좋아요 29. 가족과 함께 먹고 싶어요
10. 안경   20. 어디서 만날까요   30. 이 음식 정말 맛있네요
```

자극어 5~10 은 K-WAB 명칭 단어 (구상 사물). 11~20 은 일상 짧은 발화. 21~30 은 긴 문장 (조음 + 운율 평가).

## 4. CSV 양식

### 4.1 WER/CER 평가용 CSV (sample-fixture.csv 와 동일)

```csv
sample_id,age,severity,device_type,noise,lighting,ground_truth,transcript
P001-01,68,moderate,android,low,normal,"사과","사과"
P001-02,68,moderate,android,low,normal,"학교","학구"
P001-03,68,moderate,android,low,normal,"텔레비전","텔레비전"
... (P001 의 30 자극어)
P002-01,72,severe,ios,mid,normal,"사과","사가"
... (P002 의 30 자극어)
```

총 행 수: 30 환자 × 30 자극어 = **900 행** (또는 환자별 평균 자극어 수에 따라 600~900)

### 4.2 RTF 평가용 CSV

```csv
sample_id,age,severity,device_type,noise,audio_duration_ms,processing_ms
P001-01,68,moderate,android,low,1500,42.3
P001-02,68,moderate,android,low,1800,38.5
...
```

audio_duration_ms 와 processing_ms 는 STT 호출부 telemetry 로 자동 수집:
- 브라우저: `performance.now()` start/end + AudioBuffer.duration
- 서버: API 응답 시각 - 요청 시각 + 음성 metadata duration

## 5. 품질 기준 (수집 단계)

| 항목 | 기준 | 부적합 처리 |
| --- | --- | --- |
| 녹음 SNR | ≥ 20 dB | 재녹음 |
| 자극어 발화 완결 | 모든 음절 발음 | 부분 발화 사례는 별도 표기 (severity=severe) |
| Ground truth 임상가 합의 | 1차+검증자 일치 | 불일치 시 3자 합의 또는 제외 |
| device_type 일관성 | 환자 1명 = 1 device | 변경 시 sample_id 분리 |
| 가명 ID 충돌 | 기관별 prefix (P=부산대, S=서울 Big5 등) | 합쳐 사용 시 prefix 의무 |

## 6. 평가 실행

### 6.1 WER/CER

```bash
npm run ai-eval:wer -- \
  --input data/ai-eval/<dataset-name>.csv \
  --dataset ko-aphasia-pusan-2026q2 \
  --model server-stt:openai \
  --timestamp 2026-05-15T09:00:00.000Z
```

출력:
- `docs/regulatory/ai-evaluation-runs/2026-05-15T09-00-00-000Z/report.json`
- `docs/regulatory/ai-evaluation-runs/2026-05-15T09-00-00-000Z/report.md`

### 6.2 RTF/P95

```bash
npm run ai-eval:rtf -- \
  --input data/ai-eval/<rtf-dataset>.csv \
  --dataset rtf-pusan-2026q2 \
  --model server-stt:openai \
  --p95-target-ms 41.5
```

출력:
- `docs/regulatory/ai-evaluation-runs/rtf-2026-05-15T09-00-00-000Z/report.{json,md}`

### 6.3 합격 기준 (claim-lock §4 → §3 승격)

| 지표 | 임계값 | 출처 |
| --- | --- | --- |
| meanWer | ≤ 0.15 | 제품기획서 클레임 |
| byAgeGroup 80s passRateAt15 | ≥ 0.65 | 내부 STT 성능 합격 기준 |
| meanRtf | < 1.0 | 내부 STT 처리성능 합격 기준 |
| p95LatencyMs | ≤ 41.5 ms | 제품기획서 정량 클레임 |
| passRateP95Target | ≥ 0.85 | 내부 STT 처리성능 합격 기준 |

## 7. 데이터 보관·폐기

- 음성 원본: 평가 종료 + 보고서 확정 + 6개월 → secure delete (`usability-evaluation-irb-package.md` §8 동일 정책)
- CSV 산출물 (가명 ID 만): `data/ai-eval/<dataset>.csv` 영구 보관 (재평가 + 변경허가 증적)
- 보고서 (`docs/regulatory/ai-evaluation-runs/`): 영구 보관 (claim-lock §3 사이버보안·형상관리·변경관리 행 증거)
- lookup 테이블 (가명 ID ↔ 환자 식별 정보): 오프라인 종이 보관, 6개월 후 파쇄

## 8. 협력 기관 협의 항목

| 항목 | 협의 시점 |
| --- | --- |
| IRB 승인 (자체 vs 본 가이드 사용) | D-60 |
| 환자 모집 timeline | D-45 |
| 녹음 환경 표준화 사전 점검 | D-30 |
| 임상가 ground truth 작성 인력 | D-20 |
| 가명 ID prefix 결정 | D-15 |
| 데이터 송부 방법 (암호화 USB / 보안 클라우드) | D-7 |
| 평가 결과 공동 발표 권리 | 본 협의 단계 |

## 9. 갱신 이력

- 2026-04-30 v0.1: 초안. 모집 분포 (60s 10 / 70s 12 / 80s 8), 30 자극어 (별첨 A), CSV 양식 2종 (WER + RTF), 합격기준 5 지표, 데이터 보관·폐기 정책, 협력기관 협의 항목 7건.
