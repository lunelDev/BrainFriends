# AI STT 성능평가 (WER/CER) 리포트

- generatedAt: 2026-04-30T00:00:00.000Z
- datasetId: ko-aphasia-fixture-v0.1
- modelId: wasm:Xenova/whisper-tiny
- rowCount: 5

## Overall

| total | meanWer | meanCer | passRateAt15 (WER ≤ 0.15) |
| --- | --- | --- | --- |
| 5 | 0.5333 | 0.0286 | 0.4 |

## By Age Group

| key | total | meanWer | meanCer | passRateAt15 |
| --- | --- | --- | --- | --- |
| 60s | 2 | 0.5 | 0 | 0.5 |
| 70s | 2 | 0.3334 | 0.0715 | 0.5 |
| 80s | 1 | 1 | 0 | 0 |

## By Severity

| key | total | meanWer | meanCer | passRateAt15 |
| --- | --- | --- | --- | --- |
| mild | 1 | 0 | 0 | 1 |
| moderate | 2 | 0.5 | 0 | 0.5 |
| severe | 2 | 0.8334 | 0.0715 | 0 |

## By Noise Level

| key | total | meanWer | meanCer | passRateAt15 |
| --- | --- | --- | --- | --- |
| high | 1 | 1 | 0 | 0 |
| low | 3 | 0.3333 | 0 | 0.6667 |
| mid | 1 | 0.6667 | 0.1429 | 0 |

## By Device

| key | total | meanWer | meanCer | passRateAt15 |
| --- | --- | --- | --- | --- |
| android | 3 | 0.3333 | 0 | 0.6667 |
| ios | 1 | 0.6667 | 0.1429 | 0 |
| ipad | 1 | 1 | 0 | 0 |

## Per-Sample Rows

| sampleId | age | ageGroup | severity | device | noise | lighting | wer | cer | passes15 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P001 | 68 | 60s | moderate | android | low | normal | 0 | 0 | ✅ |
| P002 | 72 | 70s | severe | ios | mid | dim | 0.6667 | 0.1429 | ✗ |
| P003 | 75 | 70s | mild | android | low | bright | 0 | 0 | ✅ |
| P004 | 82 | 80s | severe | ipad | high | dim | 1 | 0 | ✗ |
| P005 | 65 | 60s | moderate | android | low | normal | 1 | 0 | ✗ |
