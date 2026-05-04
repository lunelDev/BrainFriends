# STT 성능 벤치마크 (RTF / latency) 리포트

- generatedAt: 2026-04-30T00:00:00.000Z
- datasetId: rtf-fixture-v0.1
- modelId: wasm:Xenova/whisper-tiny
- p95TargetMs: 41.5
- rowCount: 10

## Overall

| total | meanRtf | meanMs | p50Ms | p95Ms | p99Ms | passRateP95Target |
| --- | --- | --- | --- | --- | --- | --- |
| 10 | 0.0157 | 45.94 | 40.55 | 72.205 | 74.761 | 0.6 |

## By Age Group

| key | total | meanRtf | meanMs | p50Ms | p95Ms | p99Ms | passRateP95Target |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 60s | 3 | 0.0156 | 35.4 | 35 | 37.7 | 37.94 | 1 |
| 70s | 5 | 0.0149 | 41.9 | 41 | 51.2 | 52.4 | 0.6 |
| 80s | 2 | 0.018 | 71.85 | 71.85 | 75.045 | 75.329 | 0 |

## By Severity

| key | total | meanRtf | meanMs | p50Ms | p95Ms | p99Ms | passRateP95Target |
| --- | --- | --- | --- | --- | --- | --- | --- |
| mild | 3 | 0.0157 | 34.6 | 33.2 | 39.41 | 39.962 | 1 |
| moderate | 4 | 0.0161 | 47.35 | 39.5 | 70.24 | 74.368 | 0.75 |
| severe | 3 | 0.0153 | 55.4 | 52.7 | 66.74 | 67.988 | 0 |

## By Noise Level

| key | total | meanRtf | meanMs | p50Ms | p95Ms | p99Ms | passRateP95Target |
| --- | --- | --- | --- | --- | --- | --- | --- |
| high | 2 | 0.018 | 71.85 | 71.85 | 75.045 | 75.329 | 0 |
| low | 5 | 0.0156 | 35.36 | 35 | 39.68 | 40.016 | 1 |
| mid | 3 | 0.0144 | 46.3 | 45.2 | 51.95 | 52.55 | 0.3333 |

## By Device

| key | total | meanRtf | meanMs | p50Ms | p95Ms | p99Ms | passRateP95Target |
| --- | --- | --- | --- | --- | --- | --- | --- |
| android | 5 | 0.0158 | 37.88 | 35 | 49.76 | 52.112 | 0.8 |
| ios | 3 | 0.0142 | 42.1 | 41 | 44.78 | 45.116 | 0.6667 |
| ipad | 2 | 0.018 | 71.85 | 71.85 | 75.045 | 75.329 | 0 |
