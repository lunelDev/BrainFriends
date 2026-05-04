# WASM-STT 공인시험 사전 시험설계서 v0.1

작성일: 2026-05-04  
대상 기능: 브레인프렌즈 훈련 useCase WASM 온디바이스 STT  
관련 문서: `claim-lock.md`, `cloud-and-data-transfer.md`, `wasm-stt-model-evaluation-plan.md`, `ai-evaluation-data-collection-guide.md`, `risk-management-file.md`

## 1. 목적

본 문서는 브레인프렌즈 WASM-STT 기능을 공인시험기관 또는 외부 시험기관에 의뢰하기 전, 시험 항목·환경·절차·합격 기준을 고정하기 위한 사전 시험설계서다.

본 문서는 공인성적서가 아니다. 내부 예비시험과 시험기관 문의에 사용할 기준 문서이며, 실제 공인성적서는 시험기관이 확정한 절차와 환경에 따라 별도로 발행한다.

## 2. 시험 대상

| 항목 | 내용 |
| --- | --- |
| 제품명 | BrainFriends |
| 기능 | 훈련 useCase WASM 온디바이스 STT |
| 코드 위치 | `src/lib/speech/wasmSttAdapter.ts` |
| 현재 엔진 | `transformers.js@4.2.0:Xenova/whisper-tiny:v0.1` |
| 입력 | 브라우저 마이크 녹음 Blob |
| 출력 | transcript, confidence, engineVersion |
| 언어 | 한국어 고정 (`ko`, `korean`, `ko-KR`) |
| 데이터 전송 | 훈련 useCase 원본 음성 서버 미전송 |

## 3. 시험 목적과 성적서 연결

| 시험 목적 | 내부 예비시험 | 공인성적서 후보 |
| --- | --- | --- |
| 한국어 전사 정확도 확인 | WER/CER 자동 산출 | STT 전사 정확도 성적 |
| 온디바이스 처리 성능 확인 | RTF/P95 latency 산출 | 처리시간/응답시간 성적 |
| 서버 미전송 경계 확인 | rawAudioLeavesDevice=false 확인 | 개인정보/보안 구조 설명자료 |
| 모델·버전 고정 확인 | release manifest/SOUP 연결 | 시험 대상 버전 명시 |

## 4. 시험 항목

### 4.1 정확도 시험

| 항목 | 정의 | 산식 | 합격 기준 |
| --- | --- | --- | --- |
| WER | 단어 오류율 | (S + D + I) / N | 평균 15% 이하 |
| CER | 문자 오류율 | 문자 단위 (S + D + I) / N | 평균 10% 이하 |
| sample pass rate | 개별 샘플 WER ≤ 15% 비율 | pass / total | 80% 이상 |
| 80대 pass rate | 80대 샘플 중 WER ≤ 15% 비율 | pass / total | 65% 이상 |

### 4.2 처리성능 시험

| 항목 | 정의 | 산식 | 합격 기준 |
| --- | --- | --- | --- |
| RTF | Real Time Factor | processing_ms / audio_duration_ms | 평균 1.0 미만 |
| P95 latency | 처리시간 95백분위 | p95(processing_ms) | 목표 41.5ms 이하 |
| model load time | 최초 모델 로딩 시간 | readyAt - startedAt | 내부 기준 기록 |
| cache hit load time | 캐시 후 재로딩 시간 | readyAt - startedAt | 500ms 이하 목표 |

### 4.3 운영 안정성 시험

| 항목 | 정의 | 합격 기준 |
| --- | --- | --- |
| 30분 반복 사용 | 동일 브라우저에서 반복 녹음/전사 | crash 없음 |
| 메모리 증가 | 30분 전후 JS heap 증가 | 50MB 이하 목표 |
| 실패 처리 | 모델 로드/전사 실패 시 안내 | reviewRequired 또는 대체 입력 안내 |
| 서버 업로드 차단 | daily/game training에서 원본 서버 전송 여부 | WASM 미지원 시 client preflight 차단 |

## 5. 시험 데이터셋

### 5.1 최소 내부 예비시험

| 항목 | 기준 |
| --- | --- |
| 샘플 수 | 10~30개 |
| 문장 | 재활 과제 문장, AAC 일상 의도 문장, K-WAB 유사 자극어 |
| 대상 | 내부 녹음 또는 동의된 비식별 음성 |
| 목적 | 모델 후보 탈락 여부 판단 |

### 5.2 공인시험 의뢰 후보 데이터셋

| 항목 | 기준 |
| --- | --- |
| 샘플 수 | 30명 × 30자극어 = 최대 900행 |
| 연령 | 60대, 70대, 80대 분포 |
| 질환군 | 실어증, 마비말장애 |
| ground truth | 임상가 1차 전사 + 검증자 확인 |
| 제외 | 동의 없는 음성, 급성 응급 상태, 1차 허가 범위 외 대상 |

## 6. 시험 환경

| 환경 | 브라우저 | 기기 | 목적 |
| --- | --- | --- | --- |
| E1 고성능 PC | Chrome 최신 | Intel i5 이상 / RAM 16GB | 기준 성능 |
| E2 중간 사양 노트북 | Chrome 최신 | RAM 8GB | 일반 병원/가정 |
| E3 저사양 또는 태블릿 | Chrome/Edge 또는 Android Chrome | RAM 4~8GB | 사용성 한계 확인 |

시험기관이 환경을 확정할 경우 본 표보다 시험기관 조건을 우선한다. 단, 제품 클레임에는 실제 시험 환경을 명시한다.

## 7. 시험 절차

### 7.1 준비

1. 제품 build/version 확정
2. `WASM_STT_ENGINE_VERSION` 기록
3. 모델 파일 및 SOUP/release manifest 기록
4. 브라우저 캐시 초기화 상태와 캐시 hit 상태를 분리
5. 테스트 문장 CSV 준비
6. ground truth 확정

### 7.2 정확도 시험

1. 샘플별 오디오를 동일 환경에서 입력
2. `transcribeWithWasmStt()` 실행
3. transcript 저장
4. `npm run ai-eval:wer` 실행
5. WER/CER 및 연령대별 pass rate 산출
6. 오류 샘플은 error-case log에 기록

### 7.3 처리성능 시험

1. audio_duration_ms 기록
2. 전사 시작/종료 시간을 `performance.now()` 기준으로 측정
3. processing_ms 기록
4. `npm run ai-eval:rtf` 실행
5. RTF, mean, P50/P95/P99 산출
6. 최초 로딩과 캐시 후 로딩을 분리 기록

### 7.4 운영 안정성 시험

1. 30분 반복 사용 시나리오 수행
2. 메모리 사용량 시작/종료 기록
3. 실패 발생 시 errorCode, message, recovery 동작 기록
4. 훈련 useCase에서 서버 업로드가 발생하지 않는지 확인

## 8. 결과 기록 양식

### 8.1 정확도 CSV

```csv
sample_id,age,severity,device_type,noise,lighting,ground_truth,transcript
P001-01,68,moderate,pc,low,normal,"물 좀 주세요","물 좀 주세요"
```

### 8.2 처리성능 CSV

```csv
sample_id,age,severity,device_type,noise,audio_duration_ms,processing_ms
P001-01,68,moderate,pc,low,2500,1800
```

### 8.3 시험기관 전달 패키지

| 파일 | 용도 |
| --- | --- |
| 본 문서 | 시험 항목·절차 설명 |
| `wasm-stt-model-evaluation-plan.md` | 모델 후보와 합격 게이트 |
| `ai-evaluation-data-collection-guide.md` | 데이터 수집 SOP |
| `claim-lock.md` | 시험 결과 반영 전/후 클레임 통제 |
| release manifest | 시험 대상 버전 고정 |
| SOUP/SBOM | 외부 라이브러리 및 모델 자산 |
| 내부 예비시험 report | 공인시험 전 리허설 결과 |

## 9. 판정 원칙

| 결과 | 조치 |
| --- | --- |
| 정확도/성능 모두 합격 | “훈련 useCase WASM 온디바이스 STT 적용” 클레임 유지 가능 |
| 정확도 불합격, 성능 합격 | 한국어 fine-tune 후보로 모델 교체 후 재시험 |
| 성능 불합격, 정확도 합격 | 사용 환경 제한 또는 모델 축소 |
| 모두 불합격 | STT 클레임 하향, AAC/치료사 검토 중심으로 대체 |

## 10. 금지 사항

- 내부 예비시험 결과를 공인성적서로 표현하지 않는다.
- `NEXT_PUBLIC_DEV_MODE=true`의 mock STT 결과를 성능 근거로 사용하지 않는다.
- 시험 전에는 “WER 15% 달성”을 확정 표현하지 않는다.
- 시험환경을 명시하지 않고 “모든 기기에서 실시간”이라고 표현하지 않는다.

## 11. 다음 작업

1. 내부 예비시험용 10~30개 오디오 샘플 준비
2. `/dev/wasm-stt-test`로 transcript, processing_ms 수집
3. `npm run ai-eval:wer`, `npm run ai-eval:rtf` 실행
4. 내부 예비시험 report 생성
5. 시험기관 문의 패키지 작성

## 12. 갱신 이력

- 2026-05-04 v0.1: 초안. WASM-STT 공인시험 사전 시험항목, 시험환경, 시험절차, 합격 기준, 결과 양식, 시험기관 전달 패키지 정의.
