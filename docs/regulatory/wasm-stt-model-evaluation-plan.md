# WASM STT 모델 평가 계획 v0.1

작성일: 2026-04-30
근거: claim-lock §3 "WASM 온디바이스 STT (훈련 useCase)" / §4 "STT" 조건부 클레임 / 제품기획서 "Whisper-ko Fine-tuning, WER 15%↓, P95 41.5ms" 정량 클레임
관련: `wasmSttAdapter.ts` (현재 v0.1: Xenova/whisper-tiny), `werRunner.ts` (WER/CER), `sttBenchmark.ts` (RTF/P95), `accredited-test-preplan-wasm-stt.md` (공인시험 사전 시험설계), `risk-management-file.md` v0.5 RM-001/RM-002

## 1. 목적

이 문서는 브레인프렌즈 WASM 온디바이스 STT 의 한국어 fine-tune 모델 후보를 평가하기 위한 **3 단계 결정 게이트**를 정의한다. 식약처 인허가 첨부자료 "AI 성능평가" 산출물의 골격이며, claim-lock §4 STT / WER 행을 §3 사용 가능 클레임으로 승격하는 데 필요한 데이터를 산출한다.

본 문서는 평가 결과 보고서가 아니다. 평가 진행 후 결과는 `docs/remediation/03-ai-evaluation/runs/` 의 자동 생성 리포트와 `wasm-stt-model-evaluation-report-v1.0.md` 에 기록한다.

## 2. 후보 모델

HuggingFace Hub 에서 transformers.js 호환 (ONNX 포맷 export 가능) Whisper 변형 중 한국어 성능이 보고된 모델을 1차 후보로 한다.

| ID | 모델명 (HF) | 베이스 | 한국어 fine-tune | 모델 사이즈 (ONNX fp32) | 특이사항 |
| --- | --- | --- | --- | --- | --- |
| C1 | `Xenova/whisper-tiny` | tiny (39M) | × | ~78MB | 현재 v0.1 default. 다국어 (한국어 포함) |
| C2 | `Xenova/whisper-base` | base (74M) | × | ~290MB | tiny 보다 정확. 모바일 다운로드 부담 ↑ |
| C3 | `Xenova/whisper-small` | small (244M) | × | ~970MB | 정확도 우수. WASM 환경에서 메모리/지연 부담 ↑ |
| C4 | (커뮤니티) `KoWhisper-tiny` 후보 | tiny | ✅ KO 코퍼스 | TBD | HF 검색 + 라이선스 검토 필요 |
| C5 | (커뮤니티) `Whisper-ko-medical` 후보 | tiny/base | ✅ KO 의료 코퍼스 | TBD | 실어증·조음장애 fine-tune 모델 가용성 조사 필요 |

> **확정 전 작업**: C4/C5 의 구체 모델 ID 는 임상 협력기관과 라이선스 (Apache-2.0 / MIT 권장) 검토 후 본 표에 등재한다. 후보 추가 시 본 §2 표 + `WASM_STT_MODEL_ID` (`wasmSttAdapter.ts`) 수정 + release manifest 갱신 트리거 발생.

## 3. 3 단계 결정 게이트

후보 모델은 다음 3 단계를 통과해야 production 후보로 승격된다.

### 3.1 1단계 — 환경 적합성 (RTF / P95 / 메모리)

**도구**: `npm run ai-eval:rtf` (`src/lib/ai/sttBenchmark.ts`)

**입력 양식**: `data/ai-eval/<dataset>.csv` — `sample_id,age,severity,device_type,noise,audio_duration_ms,processing_ms`

**측정 환경**: 사양별 3 종 (저성능 / 중간 / 고성능). 각 환경에서 30 샘플 이상.

| 합격 기준 | 임계값 | 출처 |
| --- | --- | --- |
| meanRtf | < 1.0 (실시간 이상) | claim-lock §3 온디바이스 사용성 |
| p95LatencyMs | ≤ 41.5ms | 제품기획서 정량 클레임 |
| passRateP95Target | ≥ 0.85 (85% 이상) | claim-lock §4 → §3 승격 조건 |
| 모델 메모리 점유 | < 1GB | 모바일 / 저사양 PC 동작 |

**불합격 시 처리**: 후보 탈락 또는 환경 제한 명시 (예: "Android 저사양 제외").

### 3.2 2단계 — 한국어 정확도 (WER / CER)

**도구**: `npm run ai-eval:wer` (`src/lib/ai/werRunner.ts`)

**입력 양식**: `data/ai-eval/<dataset>.csv` — `sample_id,age,severity,device_type,noise,lighting,ground_truth,transcript`

**데이터셋**: 60~80대 환자 음성 30~50건 (claim-lock §4 WER 행 해제 조건). 임상 협력기관 (부산대 등) 동의 후 수집.

| 합격 기준 | 임계값 | 출처 |
| --- | --- | --- |
| meanWer | ≤ 0.15 (15% 이하) | 제품기획서 정량 클레임 |
| meanCer | ≤ 0.10 (10% 이하) | 한국어 음절 단위 보조 지표 |
| passRateAt15 (per-sample) | ≥ 0.80 | 분포 안정성 |
| byAgeGroup 80s passRateAt15 | ≥ 0.65 | 고령 사용자 보장 (1차 모집단) |

**불합격 시 처리**: claim-lock §4 WER 행 유지 (목표 표현). C1 (Xenova/whisper-tiny) 도 첫 평가에서 탈락 가능 → C4/C5 fine-tune 모델로 우회.

### 3.3 3단계 — 운영 안정성 (메모리·배터리·반복 사용)

**도구**: 별도 별도 브라우저 측정 (Chrome DevTools Performance + Memory). 본 게이트는 결정성 함수 미적용 — 수동 검증.

| 합격 기준 | 임계값 | 출처 |
| --- | --- | --- |
| 30분 연속 훈련 후 메모리 누수 | < 50MB 증가 | 주간 K-WAB 1 세션 (~15분) × 2 |
| 모바일 배터리 소모 | 30분당 < 10% (저사양 기기) | 가정 환경 사용성 |
| 모델 재로드 시간 (cache hit) | < 500ms | UX 보장 |
| `wasmSttLoadingState` 머신 idempotent | reproducible | TC-WASM-STT-LOADING-001 결정성 검증 |

## 4. 평가 절차

### 4.1 신규 후보 도입 SOP

1. HF Hub 에서 모델 ID 확정 + 라이선스 (Apache-2.0 / MIT) 검토
2. 본 §2 표에 행 추가
3. `wasmSttAdapter.ts` `WASM_STT_MODEL_ID` 후보 변경 (별도 branch / NEXT_PUBLIC_WASM_STT_MODEL_OVERRIDE 환경변수)
4. release manifest 갱신 (`SR-CHANGE-016` 자동 트리거 — major variation, requiresRegulatoryFiling=true 가능성)
5. 1단계 → 2단계 → 3단계 순차 평가

### 4.2 데이터 수집 양식

**RTF 측정용 CSV** (브라우저 콘솔 또는 telemetry 로 수집):
```csv
sample_id,age,severity,device_type,noise,audio_duration_ms,processing_ms
P001,68,moderate,android-mid,low,2500,38.0
```

**WER 측정용 CSV** (사람 전사 ground truth + 모델 hypothesis 수집):
```csv
sample_id,age,severity,device_type,noise,lighting,ground_truth,transcript
P001,68,moderate,android,low,normal,"오늘 날씨가 좋네요","오늘 날씨가 좋네요"
```

### 4.3 결정 트리거

- 1단계 합격 + 2단계 합격 → production 후보 승격, claim-lock §4 STT/WER 행 → §3 승격 검토
- 1단계 합격 + 2단계 불합격 → 다음 후보 (C4/C5 fine-tune) 평가
- 1단계 불합격 → 모델 사이즈 한 단계 축소 또는 환경 제한 명시
- 모든 후보 1·2단계 불합격 → claim-lock §4 "WER 15% 이하 달성" 행 영구 하향 검토

## 5. 결정성 V&V 매핑

| 본 문서 § | 결정성 함수 | 검증 케이스 |
| --- | --- | --- |
| §3.1 RTF/P95 | `evaluateRtfRows` (`sttBenchmark.ts`) | TC-AI-RTF-RUNNER-001 |
| §3.2 WER/CER | `evaluateWerRows` (`werRunner.ts`) | TC-AI-EVAL-RUNNER-001 |
| §3.3 로딩 머신 | `wasmSttLoadingState.ts` 상태 전이 | TC-WASM-STT-LOADING-001 |
| §4.1 신규 후보 영향평가 | `analyzeChangeImpact` (`changeImpactAnalysis.ts`) | TC-CHANGE-016-001 |

## 6. 갱신 트리거

- 신규 후보 모델 추가 (§2 표 변경) → release manifest 갱신
- 합격 기준 변경 (§3 임계값 수정) → claim-lock §4 행 동시 갱신
- 1차 평가 결과 수집 → 본 문서 v0.2 (결과 표 추가) + claim-lock §4 → §3 승격 결정
- 공인시험기관 사전상담 결과 수령 → `accredited-test-preplan-wasm-stt.md` 와 본 문서의 시험항목·임계값 동시 갱신
- HuggingFace transformers.js 메이저 버전 변경 → `WASM_STT_PACKAGE_VERSION` 갱신 + 전체 후보 재평가

## 7. 갱신 이력

- 2026-04-30 v0.1: 초안. 후보 5종 (C1 Xenova/whisper-tiny default + C2 base + C3 small + C4/C5 KoWhisper TBD), 3 단계 결정 게이트 (RTF/P95 → WER/CER → 운영 안정성), 합격 기준 정량 임계값, 결정성 V&V 매핑. 1차 평가 데이터 수집은 임상 협력기관 (부산대 등) 협력 대기.
