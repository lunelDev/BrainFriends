# 브레인프렌즈 클라우드·데이터 전송 명세 v0.1

작성일: 2026-04-29  
상위 문서: `claim-lock.md`, `risk-management-file.md`, `traceability-matrix.md`  
목적: 브레인프렌즈에서 어떤 데이터가 브라우저, 서버, 외부 서비스로 이동하는지 허가·심사 관점에서 명확히 고정한다.

## 1. 결론

브레인프렌즈는 현재 제품 전체를 “원본 미전송 완전 온디바이스”로 설명하면 안 된다.

정확한 현재 표현은 다음과 같다.

> 안면·시선 분석은 브라우저 내 MediaPipe/WASM 기반 온디바이스 처리를 적용한다. 음성 STT는 제품 기본값으로 브레인프렌즈 서버의 보안 프록시를 통해 처리한다. 브라우저가 외부 STT API로 직접 전송하지는 않지만, 서버 프록시가 외부 STT 서비스를 호출하는 경우 녹음 음성이 제한적으로 외부 처리될 수 있다.

현재 STT 정책은 다음과 같다.

| useCase | 현재 정책 | 원본 음성 외부 전송 | 비고 |
| --- | --- | --- | --- |
| `daily_training` | 서버 보안 프록시 STT 기본 | 있음 | 훈련용. 원본 음성 영구 저장 금지, metadata 기록 |
| `game_training` | 서버 보안 프록시 STT 기본 | 있음 | Sentence Magic 등 게임 훈련 |
| `weekly_kwab` | 서버 보안 프록시 STT 허용 | 있음 | 평가 목적. useCase 추적 필요 |
| `clinical_evaluation` | 서버 보안 프록시 STT 허용 | 있음 | 임상 평가 목적. useCase 추적 필요 |
| `wasm_experiment` | 실험/오프라인 후보 | 없음 | 성능·호환성 미달 시 제품 기본 기능으로 주장하지 않음 |

## 2. 데이터 흐름 요약

| 데이터 | 발생 위치 | 처리 위치 | 저장 위치 | 외부 전송 | 현재 통제 |
| --- | --- | --- | --- | --- | --- |
| 얼굴 영상 | 브라우저 카메라 | 브라우저 MediaPipe | 원본 영상 저장 안 함 | 없음 | FaceLandmarker 결과만 지표화 |
| 안면 랜드마크 | 브라우저 | 브라우저 | step 결과 일부 또는 요약 지표 | 없음 | 측정 품질·fallback |
| 시선 지표 | 브라우저 | 브라우저, 세션 결과 payload | 누적기, history summary, 치료사 화면 참고 표시 | 없음 | `gazeAccumulator`, V&V |
| 음성 원본 | 브라우저 마이크 | useCase별 STT 정책 | 일부 흐름에서 Blob 참조 또는 서버 전송 | 조건부 있음 | `sttPolicy`, client preflight, `sttReview`, version metadata |
| STT transcript | 서버 또는 브라우저 결과 | 서버/브라우저 | 결과 payload, 리포트 | 없음 | reviewRequired 플래그 |
| AAC 심볼 선택 | 브라우저 | 브라우저+서버 재계산 | `aac_intent_logs` | 없음 | 서버측 문장 재생성, audit |
| K-WAB 점수 | 브라우저/서버 | 앱 내부 | clinical results/history | 없음 | 보조 채점·치료사 검토 |
| 보호자 리포트 | 서버 | 서버 | guardian link table | 없음 | 토큰, 만료, 폐기, read-only |
| 이상반응 | 브라우저 | 서버 | `adverse_events` | 없음 | 최신순 조회, 중증 미확인 분류 |
| 감사로그 | 서버 | 서버 | `data/audit/*.ndjson` | 없음 | 접근·생성·폐기 이벤트 |

## 3. STT 상세

### 3.1 현재 구현 파일

| 역할 | 파일 |
| --- | --- |
| STT useCase 정책 | `src/lib/speech/sttPolicy.ts` |
| STT runtime 상태 분리 | `src/lib/speech/sttRuntime.ts` |
| STT client preflight | `src/lib/speech/sttClientPreflight.ts` |
| WASM STT adapter | `src/lib/speech/wasmSttAdapter.ts` (실험/오프라인 후보) |
| STT prompt 생성 및 prompt hash | `src/lib/speech/sttPrompt.ts` |
| STT 실패·빈 전사 review-required 분류 | `src/lib/speech/sttReview.ts` |
| 클라이언트 분석기 | `src/lib/speech/SpeechAnalyzer.ts` |
| 서버 STT 프록시 | `src/app/api/proxy/stt/route.ts` |
| 결과 버전 메타데이터 | `src/lib/analysis/versioning.ts` |
| V&V | `src/lib/vnv/runDeterministicChecks.ts` |

### 3.2 서버 STT 허용 조건

서버 STT는 다음 조건에서만 허용한다.

| 조건 | 설명 |
| --- | --- |
| useCase가 `daily_training`, `game_training`, `weekly_kwab`, `clinical_evaluation` 중 하나 | 제품 기본 STT |
| `OPENAI_API_KEY` 존재 | 서버 프록시가 외부 STT 호출 가능 |
| audio/file form field 존재 | 음성 파일이 없으면 실패 처리 |

그 외에는 `server_stt_blocked:*` 상태로 차단하고 `reviewRequired=true`를 반환한다. STT 결과는 자동 확정 근거가 아니라 치료사 검토용 보조 전사로만 사용한다.

### 3.3 외부 STT 전송 항목

서버 STT가 허용되는 경우 외부 STT 서비스로 전송될 수 있는 항목은 다음이다.

| 항목 | 설명 | 민감도 | 통제 |
| --- | --- | --- | --- |
| audio file | 사용자가 녹음한 음성 원본 | 높음 | useCase 제한, 프록시 경유, review metadata 기록 |
| model | 현재 `whisper-1` | 낮음 | version metadata 기록 |
| language | `ko` 고정 | 낮음 | 클라이언트 요청값 무시, `sttLanguage.ts` 상수 사용 |
| prompt | 한국어 재활 과제 어휘 prompt | 중간 | prompt version/hash 기록 |

외부 STT 응답에서 저장·전달되는 항목은 다음이다.

| 항목 | 설명 | 통제 |
| --- | --- | --- |
| text | STT transcript | 빈 값이면 reviewRequired |
| segments | no_speech_prob 등 보조 정보 | confidence 산출 |
| sttStatus | `ok` 또는 `review_required` | 결과 판단 경계 |
| sttDetailStatus | `ok`, `empty_transcript`, `stt_failed`, `server_stt_blocked` | 오류 분류 |
| reviewRequired | 치료사 검토 필요 여부 | 자동 확정 방지 |
| reviewReason | 실패·차단 사유 | audit/리뷰 근거 |

## 4. 온디바이스 처리 범위

| 기능 | 온디바이스 여부 | 설명 |
| --- | --- | --- |
| 안면 랜드마크 | 적용 | MediaPipe FaceLandmarker 기반 브라우저 처리 |
| 구강 움직임 지표 | 적용 | 랜드마크 기반 계산 |
| 시선 지표 | 적용 | iris landmark 기반 계산 |
| gaze 누적 지표 | 적용 | 브라우저 세션 누적 |
| AAC 문장 preview | 적용 | 브라우저에서 규칙 기반 preview |
| AAC commit 검증 | 서버 재계산 | 서버에서 같은 sequence로 sentence 재생성 |
| STT | 제품 기본값 미적용 | WASM STT adapter는 실험/오프라인 후보로만 유지. 제품 기본값은 서버 보안 프록시 |

## 5. 저장 위치

상세 저장 위치는 `docs/remediation/02-cybersecurity/browser-server-storage-matrix.md`를 따른다.

허가 관점에서 중요한 요약은 다음이다.

| 저장 위치 | 저장 데이터 | 정책 |
| --- | --- | --- |
| 브라우저 `sessionStorage` | 임시 step review, resume metadata | 세션 범위 허용 |
| 브라우저 `localStorage` | compact history fallback | 원시 미디어 제거 후 허용 |
| 서버 DB | clinical sessions, language results, sing results, guardian links, adverse events | 1차 저장소 |
| 서버 파일 | audit log, 일부 운영 fallback | 감사·운영 증적 |
| 외부 STT 서비스 | 허용 useCase의 음성 원본 | 제한적 허용. 제품 전체 원본 미전송 표현 금지 |

## 6. 버전·변경관리 기록

STT 또는 AI 관련 결과에는 다음 메타데이터를 남기는 것을 기준으로 한다.

| 메타데이터 | 목적 |
| --- | --- |
| `stt_engine` | wasm/server/disabled 구분 |
| `stt_use_case` | daily/game/weekly/clinical 구분 |
| `stt_policy_reason` | 왜 허용 또는 차단됐는지 기록 |
| `raw_audio_leaves_device` | 원본 음성 외부 전송 여부 |
| `stt_prompt_version` | prompt 버전 |
| `stt_prompt_hash` | prompt 내용 변경 추적 |
| `stt_review_required` | 자동 확정 금지 여부 |
| `model_version` | 결과 생성에 사용된 모델·엔진 조합 |

관련 V&V:

| V&V | 내용 |
| --- | --- |
| TC-STT-001 | STT useCase별 엔진 결정 |
| TC-RISK-001 | 실패·빈 전사·서버 차단 시 reviewRequired |
| TC-RISK-006 | STT/AI 버전 메타데이터 기록 |

## 7. 대외 문구

### 7.1 사용 가능

브레인프렌즈는 안면·시선 분석을 브라우저 내 온디바이스로 처리하며, 음성 STT는 서버 보안 프록시를 통해 처리한다. 서버는 녹음 음성을 영구 저장하지 않고, 전사 결과·품질 지표·검토 필요 여부를 기록한다.

브라우저는 외부 STT API로 직접 전송하지 않는다. 서버 route는 외부 STT 호출 전 useCase, API key, 입력 파일, 언어 정책을 확인하는 방어선으로 유지한다.

`NEXT_PUBLIC_DEV_MODE=true`는 실제 WASM STT가 아니라 `mock_stt` 개발 모드다. 허가·심사 문서와 성능평가 표에서는 mock 결과를 STT 성능 근거로 사용하지 않는다.

### 7.2 조건부 사용

WASM STT는 오프라인/저비용 후보로 실험할 수 있다. 다만 현재 성능·브라우저 호환성·모델 로딩 안정성이 제품 기본값 수준이 아니므로 허가자료의 기본 STT 기능으로 주장하지 않는다.

### 7.3 사용 금지

다음 표현은 현재 사용하지 않는다.

- 전 제품 원본 데이터 미전송
- 모든 AI 추론은 온디바이스 처리
- 음성 STT도 완전 WASM 온디바이스 구현 완료
- Whisper-ko fine-tuning 적용 완료
- WER 15% 이하 달성

## 8. 남은 작업

| 우선순위 | 작업 | 이유 |
| --- | --- | --- |
| P0-Reg | STT 외부 서비스 위탁/제3자 처리 고지 문구 확정 | 개인정보·보안 심사 대응 |
| P0-Code | 서버 STT 결과 metadata와 녹음 파일 저장/ZIP export 검증 | 임상/성능 증적 확보 |
| P1 | STT WER/CER 검증셋 구축 | 성능 수치 방어 |
| P1 | 결과 리포트에 STT metadata 표시 또는 export 포함 | 변경관리 증적 |
| P1 | SBOM/취약점 점검 결과와 외부 서비스 목록 연결 | 사이버보안 증적 |

## 9. P0 상태 요약

| 항목 | 현재 상태 | 판단 |
| --- | --- | --- |
| Gaze 모듈 | 데이터 레이어, 누적기, history 저장, 치료사 화면 표시, dev 시각화, V&V 구현 | Phase 1 완료. 9-point calibration은 후속 |
| AAC 모듈 | standalone 보드, 주요 훈련 화면 통합, API, 규칙형 intent, V&V 구현 | Phase 1 완료. 사용 빈도 정렬/치료사 log 표시는 후속 |
| STT 정책 | mock/server/wasm-experiment runtime 분리, 훈련·평가 기본값 서버 STT, reviewRequired, metadata V&V 구현 | 정책·증적 완료. WASM-STT는 실험/오프라인 후보로 격하 |
| 보호자 리포트 | 생성, 만료, 폐기, audit, V&V 구현 | Phase 1 완료 |
| 이상반응 | 저장/조회 DB 보장, 중증 미확인 분류, V&V 구현 | Phase 1 완료 |
| 접근통제 | 환자 리포트 접근 정책, V&V 구현 | Phase 1 완료 |
| 저장 실패 | fallback/재시도/수동 검토 V&V 구현 | Phase 1 완료 |
| Traceability | RM/SR/TC/파일 연결 문서 작성 | v0.1 완료 |

P0는 “규제 리스크를 줄이는 Phase 1 증적” 기준으로는 대부분 완료다. 다만 “제품제안서 클레임을 100% 구현” 기준으로는 WASM-STT 실측 RTF/WER, AAC 사용 빈도 기반 UX, Gaze calibration UI가 아직 남아 있다. 현재 제품 기본값은 훈련·평가 STT 모두 보안 프록시 기반 서버 전사이며, WASM-STT는 실험/오프라인 후보로만 유지한다.

## 10. 갱신 이력

- 2026-05-07: NIDS 상담노트 및 실제 테스트 결과 반영. 상단 STT 정책 표를 "WASM 우선"에서 "서버 보안 프록시 기본, WASM은 실험/오프라인 후보"로 정정.
