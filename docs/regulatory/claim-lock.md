# 브레인프렌즈 제품 클레임 잠금표

작성일: 2026-04-29  
기준 문서: 제품기획서, 제품제안서, 디지털의료제품 허가·심사 갭 매트릭스  
적용 범위: 제안서, 인허가 신청서, IRB 문서, 시험계획서, 홈페이지/소개자료, 투자·사업화 자료

## 1. 목적

이 문서는 브레인프렌즈를 디지털의료제품 관점에서 설명할 때 사용할 수 있는 문구와 아직 사용하면 안 되는 문구를 고정한다.

제품 개발, 임상, 인허가 문서가 서로 다른 표현을 쓰면 심사 과정에서 의도한 사용목적, 성능 주장, 위험통제 범위가 흔들린다. 따라서 외부 제출 문서와 대외 설명자료는 본 문서의 클레임을 우선 기준으로 삼는다.

단, 이 문서는 최종 법적 판단서가 아니다. 식약처 사전상담, 품목분류, 임상시험계획 승인, 허가 심사 의견에 따라 갱신한다.

외부 규제 기준은 `docs/regulatory/mfds-guideline-basis.md`를 우선 참조한다.

## 2. 클레임 상태 정의

| 상태 | 의미 | 사용 원칙 |
| --- | --- | --- |
| 사용 가능 | 현재 코드·문서·운영 범위로 방어 가능한 표현 | 외부 문서에 사용 가능 |
| 조건부 | 일부 구현 또는 근거가 있으나 범위 제한이 필요한 표현 | 제한 조건을 함께 명시해야 함 |
| 금지 | 현재 근거로 방어하기 어려운 표현 | 외부 문서 사용 금지 |
| 수정 필요 | 기존 자료에 있으나 현재 표현을 바꿔야 하는 문구 | 잠금 문구로 치환 |

## 3. 사용 가능한 핵심 클레임

| 영역 | 잠금 문구 | 근거 |
| --- | --- | --- |
| 제품 유형 | 브레인프렌즈는 언어재활 훈련과 경과 모니터링을 보조하는 독립형 디지털의료기기소프트웨어로 개발 중이다. | 웹 기반 SaMD 구조, 디지털의료기기 허가·심사 대상성 |
| 등급 준비 기준 | 브레인프렌즈는 2등급 가능성을 기준으로 개발·문서·GMP·성능평가 증빙을 준비한다. 최종 품목분류와 등급은 식약처 품목분류, 사전상담 또는 인허가 심사 결과에 따라 확정한다. | `source-classification-grade-requirements.md`, `class-2-samd-readiness-matrix.md` |
| 1차 적응 범위 | 뇌졸중, 외상성 뇌손상, 기타 뇌질환 이후 발생한 실어증·마비말장애 환자의 언어재활 보조를 1차 범위로 한다. | 현재 훈련·평가 흐름과 K-WAB 기반 구조 |
| 사용자 구조 | 환자, 치료사·의사, 보호자를 포함한 3-Tier 사용 구조를 지원한다. | 환자 훈련, 치료사 대시보드, 보호자 리포트 링크 |
| 사용 환경 (장면 시나리오) | 가정, 병원, 커피숍, 은행, 공원, 마트 6개 장면을 훈련/평가 시나리오로 제공한다. 신규 환경 추가는 임상가 검토 + 이미지 자산 + 정식 PROTOCOL 확정 + 변경허가 신청을 거친다. | `trainingData.ts` PlaceType (6), `inputSchemas.ts` PlaceTypeSchema, `aacData.ts` AAC_PLACE_SYMBOLS, visual/speech/auditory/writing/reading/fluency 시나리오 매핑 |
| 멀티모달 입력 | 음성, 안면 움직임, 반응시간, 시선, AAC 심볼 입력을 재활 훈련 및 모니터링 보조 지표로 수집·분석한다. | STT, FaceLandmarker, reactionTime, gaze data layer, AAC Phase 1 |
| 안면 분석 | MediaPipe 기반 안면 랜드마크를 활용해 구강 개폐, 입술 움직임, 조음 관련 보조 지표를 산출한다. | `FaceTracker`, `faceAnalysis`, V&V |
| 시선 분석 | 홍채·눈 주변 랜드마크 기반으로 화면 중앙 응시 비율, 이탈 시간, 측정 품질을 보조 지표로 산출한다. | gaze metrics, accumulator, V&V |
| AAC | 발화가 어려운 사용자가 심볼을 선택하면 규칙 기반 템플릿으로 의도 문장을 생성하고 이력을 남길 수 있다. | AACBoard, intent template, API, V&V |
| K-WAB | K-WAB 기반 하위검사 결과를 자동 계산하고 치료사 검토를 보조한다. | K-WAB scoring, final result API |
| 노래훈련 | 노래훈련은 MIT 및 음악 기반 언어재활 선행연구를 참고한 음악·리듬 기반 발화 보조 훈련 콘텐츠이다. 가사 따라부르기 중 자음·모음 정확도, 가사 일치도, 반응시간, 안면 반응 참고값을 산출하여 치료사 검토를 보조한다. | `src/app/(training)/programs/sing-training/page.tsx`, `src/app/(result)/result-page/sing-training/page.tsx`, `src/features/sing-training/data/songs.ts`, sing result ZIP export |
| 운영 기능 | 치료사 메모, 처방, follow-up, 보호자 read-only 리포트 링크 등 재활 운영 보조 기능을 제공한다. | therapist, prescriptions, guardian report link |
| 안전·품질 기반 | V&V, 보안 감사, AI 성능평가, 부작용 보고 기능을 제품 개발 산출물로 관리한다. | V&V, security, AI evaluation, adverse-events |
| 사이버보안 통제 | 식약처 사이버보안 가이드라인 35 항목 중 ~77% 를 결정성 V&V (TC-SEC-*) 와 산출물 도큐멘테이션으로 검증한다. 비밀번호 강도, 5회 실패 잠금, 30분 idle, sliding window rate limit, HMAC 감사로그 체인, 통합 오류 dictionary, zod 입력 검증, SOUP 정규화, release manifest 무결성, **CVE 면제 등록부 (high 7건 reachability 평가)** 를 운영 중이다. | `SR-SEC-IA05/IA07/UC03/RA01/UC07/TRE01/SI07/SI05/SI04-SOUP/SI04-MANIFEST` + 결정성 TC 10건 + `docs/security/cve-exemptions.md` v0.1 |
| 형상관리·변경관리 | git SHA + package-lock + Python requirements + SBOM + SOUP + 모델 자산 sha256 을 release manifest 로 동결하고, release manifest delta 에 따라 영향받는 SR-* 와 변경허가 신청 필요 여부를 자동 산출한다. | `SR-SEC-SI04-MANIFEST`, `SR-CHANGE-016`, `lib/server/changeImpactAnalysis.ts`, `docs/security/manifest/latest.json` |
| 추적성 매트릭스 | 인허가 신청용 IEC 62304 별지 제2호 양식의 추적성 매트릭스 (요구사항-설계-구현-시험-위해 통합) 를 결정성 함수로 산출하고 JSON / Markdown / CSV 로 export 한다. | `SR-IEC62304-EXPORT`, `lib/vnv/iec62304Export.ts`, `/api/therapist/system/iec62304-traceability` |
| ISO 14971 위험관리 | 21개 RM-* 위해요인 (RM-021 DoS 신규 등재 포함) 을 V&V 결정성 함수와 매핑하고, 변경 발생 시 영향받는 위해요인을 자동 산정한다. | `docs/regulatory/risk-management-file.md` v0.3, `SR-RISK-012`, `lib/server/riskClassification.ts` |
| IEC 62366 사용적합성 | Primary Operating Function 12종 (critical 2종 포함) 을 식별하고 formative 5/5/5~8 + summative 15명 (U1 8 + U2 4 + U3 3) 설계의 사용성평가 프로토콜을 운영한다. summative 합격기준 (critical=100% / primary=80% / severe unmitigated=0) 은 결정성 함수로 자동 산출되며, 12 시나리오가 RM-001/002/003/004/005/006/008/009/010/013/016/018 위해요인 통제를 검증한다. | `docs/regulatory/usability-evaluation-protocol.md` v0.1, `SR-USABILITY-017`, `lib/usability/useScenarioValidator.ts` |
| STT 보안 프록시 처리 (훈련 useCase) | 일상 훈련(daily_training) 과 게임 훈련(game_training) 의 음성 인식은 제품 기본값으로 브레인프렌즈 서버의 보안 STT 프록시를 통해 처리한다. 브라우저가 외부 API로 직접 전송하지 않으며, 서버는 원본 음성을 영구 저장하지 않고 전사 결과와 품질 지표를 보조 지표로 사용한다. | `SR-STT-009`, `lib/speech/sttPolicy.ts`, `lib/speech/SpeechAnalyzer.ts`, `app/api/proxy/stt/route.ts`, `TC-STT-001/002/003` |
| 적응형 난이도 (IRT 결정성) | 2PL Item Response Theory 모델 (a, b parameter + θ EAP 추정) + Maximum Fisher Information 문항 선택을 결정성 함수로 산출한다. 임상 calibration (item bank a/b 추정) 후 §4 "Bayesian Adaptive Testing 적용" 클레임 §3 으로 완전 승격 가능. | `SR-IRT-018`, `lib/adaptive/irt.ts` (irt:2pl-mfi:v0.1), `TC-IRT-001` |

## 4. 조건부 클레임

| 영역 | 조건부 문구 | 제한 조건 |
| --- | --- | --- |
| 디지털치료기기 | 디지털치료기기 트랙 진입을 검토 중인 재활 보조 SaMD이다. | 아직 치료효과 확증 임상 근거가 부족하므로 “허가된 디지털치료기기”로 표현하지 않는다. |
| 품목 등급 | 2등급 가능성을 기준으로 개발·문서화를 준비한다. | 최종 등급은 식약처 품목분류 또는 사전상담 결과에 따른다. |
| AI 분석 | AI 기반 분석은 환자 상태 평가와 훈련 난이도 조정을 보조한다. | 최종 진단, 치료 결정, 처방 판단은 의료진이 수행한다고 함께 명시한다. |
| 온디바이스 처리 | 안면·시선 분석은 브라우저 내 WASM/MediaPipe 기반 온디바이스 처리를 적용한다. | STT는 기본적으로 보안 프록시 기반 서버 전사로 처리한다. 제품 전체를 "원본 음성 미전송" 또는 "완전 온디바이스 STT"로 표현하지 않는다. |
| STT | 일상·게임 훈련과 주간 K-WAB·임상평가 useCase 는 보안 정책이 적용된 서버 Whisper 경로를 기본으로 사용한다. STT 결과는 치료사 검토용 보조 전사이며, 목표 phrase 기반 유사도 판정과 함께 사용한다. | Whisper-ko fine-tuning, WER 15% 달성은 아직 별도 근거가 필요하다. WASM-STT는 실험/오프라인 후보이며 성능·호환성 검증 전까지 기본 기능으로 주장하지 않는다. |
| WER 목표 | 한국어 실어증·조음장애 음성에 대한 WER/CER 평가 체계를 구축하고 목표 성능을 검증할 예정이다. | 실제 검증셋 결과 전까지 “WER 15% 이하 달성” 금지. |
| 적응형 난이도 | 2PL IRT 모델 + MFI 문항 선택 알고리즘이 코드 수준으로 구현되어 있으며, 임상 calibration 후 통합 예정이다. | 임상 item calibration (실제 환자 응답 기반 a, b 추정) 완료 전까지 "임상에서 검증된 IRT 적용" 표현 금지. |
| 임상 근거 | 내부 단일군 관찰 자료와 사용성 데이터를 축적 중이다. | 유효성 입증, 치료 효과 확정 표현은 전향적 임상시험 이후 사용. |
| 보호자 리포트 | 보호자에게 read-only 리포트 링크를 제공할 수 있다. | 자동 이메일·카카오 발송은 구현 후 별도 클레임으로 승격. |
| 노래 기반 언어재활 근거 | 노래훈련은 Melodic Intonation Therapy(MIT), rhythm/singing 기반 언어재활 선행연구를 참고한 보조 훈련으로 설명할 수 있다. | 정식 MIT 프로토콜 또는 독립적 치료 효과로 주장하지 않는다. 현재 구현은 가사 기반 발화·운율 보조 지표 수집이며, 음정 정확도·pitch curve 비교·확증 임상 전후 효과 검증은 후속 근거가 필요하다. |

## 5. 금지 클레임

다음 표현은 현재 외부 문서에서 사용하지 않는다.

| 금지 표현 | 이유 |
| --- | --- |
| 브레인프렌즈는 실어증 또는 마비말장애를 진단한다. | 진단 확정은 의료진 영역이며 현재 제품 의도와 위험통제 범위를 초과한다. |
| 브레인프렌즈는 치료 효과가 입증된 디지털치료기기이다. | 확증 임상시험 및 허가 근거가 아직 없다. |
| NIDS 상담노트 또는 회의록으로 허가 판단이 확정되었다. | 2026-05-07 상담노트는 내부 참고용이며 공식 서면 답변·법률 근거·제출 근거가 아니다. |
| 의료진 없이 자동으로 평가·처방·치료한다. | 의료진 보조 제품으로 경계를 설정해야 한다. |
| 모든 원본 데이터는 외부 전송 없이 온디바이스로만 처리된다. | 현재 STT 경로가 서버 프록시를 포함한다. |
| Whisper-ko fine-tuned 모델을 적용했다. | 현재 일반 Whisper/STT 경로이며 fine-tuning 적용 근거가 없다. |
| WER 15% 이하를 달성했다. | 고정 검증셋 평가 결과가 필요하다. |
| Bayesian Adaptive Testing 또는 IRT를 적용했다. | 현재 구현은 휴리스틱 중심이며 IRT 모듈은 미구현 상태다. |
| AAC 발화 의도를 AI가 예측한다. | 현재 Phase 1은 규칙 기반 템플릿이다. |
| MCI 또는 치매 예방·치료 효과를 제공한다. | 1차 허가 범위에서 제외하고 후속 적응증으로 분리한다. |
| 노래훈련이 실어증 또는 마비말장애를 치료하거나 언어 회복 효과를 입증했다. | 현재 구현과 근거는 음악·리듬 기반 발화 보조 훈련 및 치료사 검토용 지표 수준이다. 치료 효과 확정은 전향적 임상시험과 전/후 비교 지표 검증 후에만 가능하다. |
| 브레인프렌즈 노래훈련은 정식 MIT 치료를 자동 제공한다. | 현재 기능은 MIT 원리를 참고한 노래 기반 발화 보조 콘텐츠이며, 치료사 cueing, 리듬 탭핑, fading, 기능문장 프로토콜 등 정식 MIT 절차 전체를 자동 제공하지 않는다. |
| 노래훈련은 음정 재활 또는 pitch 정확도 향상 효과가 입증되었다. | 현재 코드는 원곡 pitch curve와 사용자 pitch를 비교하지 않으며 음정 정확도 지표를 산출하지 않는다. |
| 식약처 허가 완료, 의료기기 등록 완료, 보험 적용 가능 | 실제 허가·등록·고시 전까지 사용 금지. |

## 6. 기존 문구 치환표

| 기존 또는 위험 문구 | 잠금 문구 | 비고 |
| --- | --- | --- |
| 5채널 멀티모달 AI 진단 | 5채널 멀티모달 재활 보조 지표 분석 | 진단 클레임 제거 |
| WASM 온디바이스·원본 미전송 | 안면·시선 분석은 온디바이스 처리, STT는 사용 목적별 보안 정책 적용 | STT 전송 리스크 반영 |
| Whisper-ko Fine-tuning 적용 | 한국어 재활 과제 어휘를 반영한 STT 평가·개선 체계 구축 중 | 구현 근거 부족 |
| WER 15% 이하 | WER/CER 목표 성능을 별도 검증셋으로 평가 예정 | 정량 근거 전까지 목표로만 유지 |
| Bayesian Adaptive Testing 기반 난이도 조절 | 규칙 기반 난이도 조정 적용, IRT/Bayesian 모델 도입 예정 | 현재 구현 기준 |
| K-WAB 자동 진단 | K-WAB 기반 채점 자동화 및 치료사 검토 보조 | 진단 확정 방지 |
| AI가 환자 의도를 예측 | AAC 심볼 선택을 규칙 기반 문장으로 변환 | Phase 1 범위 |
| 보호자 주간 리포트 자동 발송 | 보호자 read-only 리포트 링크 제공, 자동 발송은 후속 구현 | 구현 상태 반영 |
| MCI 인지개선 플랫폼 | 실어증·마비말장애 재활 보조 SaMD, MCI는 후속 적응증 검토 | 1차 범위 잠금 |
| 노래방 훈련 운율·음정 재활 | 음악·리듬 기반 발화 보조 훈련. 가사 따라부르기 중 발화 정확도, 가사 일치도, 반응시간, 안면 반응 참고값을 산출하여 치료사 검토를 보조 | 음정 치료·pitch 개선·치료효과 확정 표현 제거 |
| 노래로 언어 회복 효과 제공 | MIT 및 음악 기반 언어재활 선행연구를 참고한 보조 훈련 콘텐츠로, 내부 전/후 비교 지표와 임상시험을 통해 효과를 검증 예정 | 확증 전까지 효과 입증 표현 금지 |
| MIT 자동 치료 | MIT 원리를 참고한 음악·리듬 기반 발화 보조 훈련 | 정식 MIT 프로토콜 클레임 금지 |

## 7. 제품 범위 v0.1

### 7.1 포함 범위

- 뇌졸중, 외상성 뇌손상, 기타 뇌질환 이후 발생한 실어증·마비말장애 사용자의 언어재활 훈련 보조
- 음성, 안면 움직임, 반응시간, 시선, AAC 입력 기반 보조 지표 수집
- K-WAB 기반 자동 채점 및 경과 확인 보조
- 치료사·의사 대시보드, 메모, 처방, follow-up 운영 지원
- 보호자 read-only 리포트 링크 제공
- V&V, 보안, AI 성능평가, 부작용 보고 산출물 관리

### 7.2 제외 또는 후속 범위

- MCI, 치매 예방, 일반 인지개선 치료 효과
- 자동 진단, 자동 처방, 의료진 대체 의사결정
- 응급·급성기 판단
- 완전 온디바이스 STT
- 확증적 치료효과 주장
- 보험수가, 허가 완료, 인증 완료 주장
- VR/AR 가상융합 제품 클레임

## 8. 대외 문구 템플릿

### 8.1 기본 소개

브레인프렌즈는 뇌졸중 등 뇌질환 이후 발생한 실어증·마비말장애 환자의 언어재활 훈련과 경과 모니터링을 보조하는 독립형 디지털의료기기소프트웨어로 개발 중입니다.

### 8.2 AI 경계 문구

브레인프렌즈의 AI 분석 결과는 치료사의 임상적 판단을 보조하기 위한 참고 지표이며, 최종 평가와 치료 결정은 의료진이 수행합니다.

### 8.3 임상 근거 문구

현재 브레인프렌즈는 내부 단일군 관찰 자료와 사용성 데이터를 축적 중이며, 확증적 임상 유효성은 전향적 임상시험을 통해 검증할 예정입니다.

### 8.4 데이터 처리 문구

안면·시선 분석은 브라우저 내 온디바이스 처리를 적용하며, 음성 인식은 사용 목적과 평가 단계에 따라 별도 보안 정책이 적용된 STT 경로를 사용합니다.

## 9. 문서 승인 규칙

다음 문서는 제출 또는 배포 전 본 클레임 잠금표와 대조한다.

- 식약처 사전상담 자료
- 품목분류 질의서
- IRB 제출 문서
- 임상시험계획서
- 제품제안서·사업계획서
- 홈페이지, 브로셔, 보도자료
- 투자·과제 발표자료

검토 시 확인할 항목은 다음과 같다.

- 사용목적이 1차 범위를 벗어나지 않는가
- 진단, 치료효과, 의료진 대체 표현이 들어가지 않았는가
- STT와 온디바이스 처리 범위를 정확히 구분했는가
- AI 역할이 보조로 제한되어 있는가
- 정량 성능 수치가 실제 검증 결과와 연결되어 있는가
- 구현되지 않은 기능을 완료된 기능처럼 표현하지 않았는가

## 10. 근거 파일

| 근거 | 위치 |
| --- | --- |
| 디지털의료제품 갭 매트릭스 | `docs/regulatory/digital-medical-product-gap-matrix.md` |
| 제품제안서 대비 코드 갭 로드맵 | `docs/regulatory/digital-medical-product-gap-matrix.md` |
| V&V 요구사항 | `src/lib/vnv/requirements.ts` |
| 결정성 점검 | `src/lib/vnv/runDeterministicChecks.ts` |
| STT 정책 | `src/lib/speech/sttPolicy.ts` |
| STT 프롬프트 | `src/lib/speech/sttPrompt.ts` |
| AAC 의도 템플릿 | `src/lib/aac/intentTemplate.ts` |
| 시선 분석 | `src/utils/faceAnalysis.ts`, `src/lib/training/gazeAccumulator.ts` |
| 보호자 리포트 | `src/lib/guardian/weeklyReportSummary.ts`, `src/app/api/guardian/report-link/route.ts` |
| 위험관리 파일 | `docs/regulatory/risk-management-file.md` (v1.0) |
| 사용성평가 프로토콜 | `docs/regulatory/usability-evaluation-protocol.md` (v0.1) — IEC 62366-1 §5.4~5.9 |
| 사용성평가 결정성 함수 | `src/lib/usability/useScenarioValidator.ts` (`SR-USABILITY-017`) |
| STT 경로 | `src/lib/speech/SpeechAnalyzer.ts`, `src/app/api/proxy/stt/route.ts`, `src/lib/speech/sttPolicy.ts` |
| AI STT 성능평가 runner | `src/lib/ai/werRunner.ts` (`SR-AI-EVAL-RUNNER`, `TC-AI-EVAL-RUNNER-001`), `scripts/ai-eval-wer-runner.ts` (npm run ai-eval:wer) |
| STT 성능 벤치마크 runner | `src/lib/ai/sttBenchmark.ts` (`SR-AI-RTF-RUNNER`, `TC-AI-RTF-RUNNER-001`), `scripts/ai-eval-rtf-runner.ts` (npm run ai-eval:rtf) |
| 실험/오프라인 후보 STT 로드 상태 머신 | `src/lib/speech/wasmSttLoadingState.ts` (`SR-WASM-STT-LOADING`, `TC-WASM-STT-LOADING-001`) |
| CVE 면제 등록부 | `docs/security/cve-exemptions.md` v0.1 (high 7건: fast-xml-parser/@aws-sdk/xml-builder R2 deferred-patch + next R2 immediate-patch + flatted/minimatch/picomatch/music-metadata R0 noop-exempt) |
| GMP/QMS 결정 매트릭스 | `docs/regulatory/gmp-qms-decision-matrix.md` v0.1 (3 옵션 A/B/C trade-off, PM 1차 권고 C 하이브리드) |
| 사용성평가 IRB 부속자료 | `docs/regulatory/usability-evaluation-irb-package.md` v0.1 (동의서·모집공고문·위해성·보상·폐기 SOP·평가자 자격) |
| AI 평가 데이터 수집 가이드 | `docs/regulatory/ai-evaluation-data-collection-guide.md` v0.1 (60s 10/70s 12/80s 8 = 30건 분포, 30 자극어, CSV 양식 + 합격기준 5 지표) |
| 실험/오프라인 후보 STT 로딩 인디케이터 | `src/components/training/WasmSttLoadingIndicator.tsx` (기본 STT 클레임 근거로 사용하지 않음) |
| 적응형 난이도 (IRT) | `src/lib/adaptive/irt.ts` (`SR-IRT-018`, `TC-IRT-001`, irt:2pl-mfi:v0.1) |
| SRS / SDS (IEC 62304) | `docs/regulatory/srs.md`, `docs/regulatory/sds.md` v0.1 (별표3 [별첨2~3] 양식) |
| 시판 후 감시 + CAPA | `docs/regulatory/post-market-surveillance-plan.md`, `pms-capa-procedure.md`, `change-approval-sop.md` v0.1 |
| 허가 준비 통합 기준서 | `docs/regulatory/permit-readiness-internal-standard.md` |
| 사용자 매뉴얼 (3 사용자) | `docs/manuals/manual-therapist.md`, `manual-patient.md`, `manual-guardian.md` v0.1 |
| 실험 후보 STT React 통합 | `src/lib/speech/useWasmSttLoading.ts` (hook), `src/components/training/WasmSttLoadingIndicator.tsx`, `src/app/dev/wasm-stt-test/page.tsx` |
| 실험 후보 모델 캐싱 | `src/lib/speech/wasmSttCacheStrategy.ts`, `public/sw.js` (Service Worker stub, 기본 허가 클레임 근거로 사용하지 않음) |
| 환자 온보딩 exclusion | `src/lib/onboarding/exclusionCheck.ts` (`SR-ONBOARDING-EXCLUSION`, `TC-ONBOARDING-EXCLUSION-001`, RM-007 통제) |
| 감사로그 확대 | `src/lib/server/auditExpansion.ts` (`SR-SEC-AUDIT-EXPANSION`, RM-016 보강) |
| 보호자 발송 (Phase 2) | `src/lib/server/weeklyReportSender.ts` (`SR-GUARDIAN-SENDER`, decideSend + executeSendBatch + stub adapter) |
| IRT item bank v0.1 | `src/lib/adaptive/itemBank.ts` (`SR-IRT-ITEMBANK`, step-1 / step-2 / step-4) |
| 노래훈련 클레임 근거 | `src/app/(training)/programs/sing-training/page.tsx`, `src/app/(result)/result-page/sing-training/page.tsx`, `src/features/sing-training/data/songs.ts`, `docs/regulatory/claim-lock.md` (MIT 기반 응용은 보조 훈련 근거로만 사용) |
| PII/PHI 분리 강화 계획 | `docs/regulatory/pii-phi-separation-strengthening-plan.md` v0.1 (4 Phase, 별도 세션) |
| 추적성 매트릭스 export | `src/lib/vnv/iec62304Export.ts`, `src/app/api/therapist/system/iec62304-traceability/route.ts` |
| 사이버보안 결정성 함수 | `src/lib/server/{accountAuth,loginLockout,sessionLockout,rateLimit,auditChain,errorCodes,inputSchemas,soupRegistry,releaseManifest,releaseManifestStartup,phiMasking,riskClassification,changeImpactAnalysis}.ts` |
| Release manifest | `scripts/generate-release-manifest.mjs`, `docs/security/manifest/latest.json` (sha256 동결) |
| SOUP 목록 | `scripts/generate-soup-list.mjs`, `docs/security/soup/latest.json` |
| SBOM | `scripts/generate-sbom.mjs`, `docs/security/sbom/latest.json` |
| WER/CER 평가 함수 | `src/lib/ai/werCalculator.ts` (`SR-AI-EVAL-014`) |
| 보호자 동의 상태머신 | `src/lib/guardian/consentState.ts` (`SR-CONSENT-015`) |
| NIDS 답변 (SaMD ⊃ DTx) | `docs/decisions/2026-04-30-nids-samd-dtx-relationship.md` |
| 문서 인덱스 | `docs/regulatory/README.md` |

## 11. 갱신 트리거

다음 사건이 발생하면 본 문서를 갱신한다.

- 식약처 품목분류 또는 사전상담 회신 수령
- 의도한 사용목적 또는 대상 질환 변경
- WASM STT 또는 분리형 STT 경로 구현 완료
- IRT/Bayesian Adaptive Testing 구현 완료
- WER/CER 검증셋 평가 완료
- 임상시험계획서 확정 또는 IRB 승인
- 위험관리 파일 또는 사이버보안 문서 주요 변경
- 허가 신청서 본문 변경
- NIDS / 한국의료기기안전정보원 / 식약처 디지털의료제품지원총괄과 답변 수령
- V&V 결정성 회귀 (npm run test:vnv 실패) 또는 release manifest 무결성 검증 실패
- IEC 62304 별지 제2호 추적성 매트릭스에서 uncovered/untested 카운트 증가
- 사이버보안 35 항목 일치도 5%p 이상 변동
- 사용성평가 프로토콜 갱신 (POF / critical task 추가, summative 합격기준 변경, formative round 추가)
- WASM STT 엔진 변경 (transformers.js 버전, Whisper 모델 교체, sampleRate 변경) → release manifest 갱신 + WER/CER 재평가 트리거
- AI STT 성능평가 신규 실측값 입력 (`npm run ai-eval:wer`) → §4 WER 행 검토 + risk-management RM-001 P 값 재산정 트리거
- STT 성능 벤치마크 (RTF/P95) 신규 실측값 입력 (`npm run ai-eval:rtf`) → §4 STT 행 + 제품기획서 P95 41.5ms 클레임 검증 트리거
- WASM STT 모델 평가 계획 §2 후보 추가/교체 → release manifest 갱신 + 1·2·3 단계 재평가 트리거
- 신규 CVE high/critical 보고 (`npm run security:audit`) → `docs/security/cve-exemptions.md` §3 행 추가 의무 + reachability (R0~R3) 평가 + 면제 결정 (immediate/deferred/conditional/noop) 트리거
- IRT item bank 신규 calibration (실제 환자 응답 기반 a/b 추정) → claim-lock §4 적응형 난이도 행 → §3 완전 승격 검토 트리거
- 사용성평가 summative 15명 실시 결과 수집 → risk-management v1.x 잔여위험 재산정 + claim-lock §3 IEC 62366 행 갱신
- 임상 협력기관 30건 음성·전사 입력 → npm run ai-eval:wer 실행 → claim-lock §4 WER 행 → §3 승격 검토
- STT 엔진·정책 변경 또는 내부 실측 결과 수령 → claim-lock §4 STT/WER 행 검토
- GMP/QMS 외주사 견적 수령 → gmp-qms-decision-matrix §5 가중치 재산정
- 노래훈련 pitch tracker, 리듬 동기화 지표, MIT 유사 프로토콜, 내부 전/후 비교 결과 또는 임상시험 결과 추가 → 노래훈련 클레임 §3/§4/§5 재검토

## 12. 다음 산출물

다음으로 작성할 문서는 `docs/regulatory/intended-use-and-contraindications.md` 이다.

이 문서에서는 사용목적, 대상 환자, 사용 환경, 사용자 역할, 금기·주의 대상, 의료진 개입 지점을 허가 심사 문구에 가깝게 정리한다.

## 13. 갱신 이력

- 2026-05-06: 노래훈련 클레임 잠금 추가. 제품기획서의 "노래방 훈련 운율·음정 재활" 표현을 "MIT 및 음악 기반 언어재활 선행연구를 참고한 음악·리듬 기반 발화 보조 훈련"으로 치환하도록 고정. 사용 가능 문구는 자음·모음 정확도, 가사 일치도, 반응시간, 안면 반응 참고값을 치료사 검토용 보조 지표로 제공하는 범위로 제한. 금지 클레임에 언어 회복 효과 입증, 정식 MIT 자동 치료, 음정/pitch 개선 효과 입증을 추가.
- 2026-05-08: 노래훈련 점수 판정 기준 정정. 목표 가사를 STT prompt bias 로 넣지 않고, 자음·모음·가사 일치도 3개 발화 지표가 모두 확보된 경우에만 `measured` 점수를 산정한다. 전사 실패/미측정/관리자 skip 은 서버 저장·랭킹 반영에서 제외하고 결과 ZIP의 `scoring-evidence.json`에 판정 근거를 남긴다.
- 2026-05-07: NIDS 상담노트 반영. 제조업 허가 → GMP → 품목 인허가 순차 구조와 상담노트의 비공식 성격을 잠금. STT는 제품 기본값을 서버 보안 프록시로 고정하고, WASM-STT는 실험/오프라인 후보로 유지.
- 2026-04-30 v0.3.0: **16개 작업 일괄 처리 (사용자 위임 — D-tasks 7 + C-tasks 9)**.
  D-tasks ✅: SRS / SDS (IEC 62304 양식), 시판 후 감시 + CAPA + 변경허가 SOP, 시판 전 체크리스트, 식약처 사전상담 패키지, 사용자 매뉴얼 3종 (치료사 / 환자 / 보호자).
  C-tasks ✅ (단독 가능 부분): C1 next 16.2.4 package.json (실제 install 은 운영환경 — bash mount rename 제약), C5 환자 온보딩 exclusion check (RM-007 통제), C8 Service Worker 모델 캐싱, C9 dev/wasm-stt-test 검증 page, C2 WASM-STT React hook + Indicator 컴포넌트 (실제 sentence-magic/sing-training/step-1 통합은 다음), C6 감사로그 확대 helper (RM-016 보강 5 카테고리), C4 보호자 SMTP 발송 stub (Phase 2), C3 IRT item bank v0.1 (step-1/2/4 calibrated 단어 + step page 통합은 다음).
  C-tasks 부분 ⚠: C7 PII/PHI 분리 — 정책 문서만 (실제 DB migration 은 별도 세션 4 Phase).
  **새 SR-* 4건**: SR-ONBOARDING-EXCLUSION + SR-SEC-AUDIT-EXPANSION + SR-GUARDIAN-SENDER + SR-IRT-ITEMBANK. **새 TC 4건** (각 8~22 assertions).
  추적성 매트릭스 47행 → 51행, SR-* 풀 31 → 35, TC-* 풀 49 → 53. §10 11행 추가, §13 changelog.
  검증: `npm run test:vnv` → 53/53 PASS, `npx tsc --noEmit` → exit 0
- 2026-04-30 v0.2.5: 7개 P0 일괄 처리 (사용자 요청). (1) IRT 2PL+MFI 결정성 구현 (`lib/adaptive/irt.ts`, SR-IRT-018, TC-IRT-001 22 assertions). (2) GMP/QMS 결정 매트릭스 (3 옵션 trade-off, PM 1차 권고 C 하이브리드). (3) 사용성평가 IRB 부속자료 패키지 (동의서·모집공고문·폐기 SOP). (4) AI 평가 데이터 수집 가이드 (60~80대 30건 분포 + 30 자극어). (5) WasmSttLoadingIndicator React 컴포넌트 (presentation only, 통합은 다음). (6) **risk-management-file v1.0 마감** (§11.8 신규 산출물 7종 매핑 + §11.9 잔여위험 재평가, 개인정보/보안 → 수용 가능 승격). §3 IRT 행 추가 + §4 적응형 난이도 행 정정 + §10 5행 추가 + §11 갱신 트리거 4건. SR-* 풀 30 → 31, TC-* 48 → 49 (TC-IRT-001 신규). `npm run test:vnv` → 49/49 PASS, `npx tsc --noEmit` → exit 0
- 2026-04-30 v0.2.0: CVE 면제 (Exemption) 등록부 v0.1 신규 산출 (P0-4 완료). `docs/security/cve-exemptions.md` (177 lines) — npm audit high 7건 (fast-xml-parser, @aws-sdk/xml-builder, next, flatted, minimatch, picomatch, music-metadata) 전수 reachability 평가 (R0 unreachable 4건 / R2 transitive-conditional 3건). S3 presigned URL 영향평가 (`src/lib/server/ncpObjectStorage.ts` 단일 사용처) — vulnerable function 은 NCP Object Storage 응답 XML 파싱 경로만, sanitization + TLS + randomUUID 완화 통제 4종. 결정: immediate-patch 1 (next 16.2.4) / deferred-patch 2 (S3 SDK 차기 minor) / noop-exempt 4 (devDeps R0). §10 1행 추가, §11 갱신 트리거 1건 추가, §13 changelog. 사이버보안 35 항목 일치도 ~74% → **~77%** (SI-04 소프트웨어 구성요소 보안 행 도큐멘테이션 ✅). risk-management RM-015 (사이버보안 취약점) 잔여위험 평가 갱신 가능
- 2026-04-30 v0.1.9: WASM-STT 2단계 부분 완료. `sttBenchmark.ts`, `wasmSttLoadingState.ts` 와 관련 결정성 테스트를 추가했고, 당시에는 WASM 모델 평가 계획 문서를 함께 운용했다.
- 2026-04-30 v0.1.8: AI STT 성능평가 (WER/CER) runner 신규 산출 (P0-3 일부). `src/lib/ai/werRunner.ts` 결정성 함수 (parseWerCsv RFC 4180 quoted field, evaluateWerRows stratified by ageGroup/severity/noise/device, classifyAgeGroup 60s/70s/80s/other, JSON sortKeys 직렬화, Markdown 안정 출력). `scripts/ai-eval-wer-runner.ts` CLI + `npm run ai-eval:wer` script. `data/ai-eval/sample-fixture.csv` 5행 fixture. SR-AI-EVAL-RUNNER + TC-AI-EVAL-RUNNER-001 등재 (14 assertions). 추적성 매트릭스 41행 → 43행 (runner 모듈 + CLI 2행). claim-lock §4 "WER/CER 평가 체계 구축 중" 행: **체계 ✅** / 측정값 ✗ (60~80대 30건 입력 대기). `npm run test:vnv` → 46/46 PASS, `npx tsc --noEmit` → exit 0. 후속: 임상 협력기관 (부산대 등) 30건 음성·전사 입력 → npm run ai-eval:wer 실행 → claim-lock §4 WER 행 → §3 승격 가능
- 2026-04-30 v0.1.7: WASM 온디바이스 STT 실제 엔진 연결 (P0-1 1단계). transformers.js @huggingface/transformers v4.2.0 + Xenova/whisper-tiny 모델. `src/lib/speech/wasmSttAdapter.ts` 실제 wiring (lazy import, AudioContext 16kHz mono Float32Array 변환, 한국어 transcribe, IndexedDB 자동 캐싱, 명시 에러 4종). §3 사용 가능 클레임에 WASM 온디바이스 STT (훈련 useCase) 행 신규, §4 STT / 온디바이스 처리 행 정정, §10 어댑터 경로 매핑, §11 엔진 변경 트리거 1건 추가. SR-STT-009 + TC-STT-WASM-001 등재 (Node 환경 5종 결정성 assertion + idempotent reset + 2 rejection round-trip). 추적성 매트릭스 40행 → 41행. `npm run test:vnv` → 45/45 PASS, `npx tsc --noEmit` → exit 0
- 2026-04-30 v0.1.6: IEC 62366 사용성평가 프로토콜 v0.1 신규 산출. POF 12종 (critical 2종: POF-05 환자 중단 / POF-07 K-WAB 검토 확정) 식별, use scenario 12종 + HRUS 12 RM-* 매핑, summative 15명 (U1 8 + U2 4 + U3 3, 60~80대 중점) + DEFAULT_SUMMATIVE_CRITERIA (critical=1.0 / primary=0.8 / severe unmitigated=0) 결정성 합격기준. SR-USABILITY-017 + TC-USABILITY-001 등재. `npm run test:vnv` → 44/44 PASS, `npx tsc --noEmit` → exit 0. §3 / §10 / §11 / §13 갱신
- 2026-04-30: NIDS 답변 반영 — SaMD ⊃ DTx, 1차 SaMD 신청 + DTx 분류 후속/병행 (양자택일 아님). `docs/decisions/2026-04-30-nids-samd-dtx-relationship.md` 작성, gap-matrix §4-2/4-3/§6 정정
- 2026-04-30: 사이버보안 35 항목 일치도 ~70% → ~74%. SI-04 SOUP + Release Manifest 두 산출물 모두 ✅. SR-SEC-IA05/IA07/UC03/RA01/UC07/TRE01/SI07/SI05/SI04-SOUP/SI04-MANIFEST 10종 결정성 V&V 등재
- 2026-04-30: V&V SR-* 풀 21개 → 27개로 확장. SR-RISK-012 (ISO 14971 분류) / SR-PHI-013 (마스킹) / SR-AI-EVAL-014 (WER/CER) / SR-CONSENT-015 (보호자 동의 상태머신) / SR-CHANGE-016 (CIA) / SR-IEC62304-EXPORT 6종 신규. 추적성 매트릭스 13행 → 39행
- 2026-04-30: IEC 62304 별지 제2호 추적성 매트릭스 export 신규 — `/api/therapist/system/iec62304-traceability?format=json|md|csv` 결정성 산출. 7개 hazard ↔ SR-* 매핑 + V&V run 결과 통합
- 2026-04-30: ISO 14971 위험관리 파일 v0.3 — RM-021 (DoS) 신규 등재, HAZARD_LINKS 식별자 RM-* 통일, 결정성 V&V 함수 + IEC 62304 export 매핑 (§11) 보강
- 2026-04-30: zod 입력 검증 6개 라우트 (login / aac/intent / reset-password / find-login-id / signup / link-care / prescription redeem / adverse-events) 통합. AdverseEventInputSchema severity 형식 (number 1/2/3) DB 와 통일
- 2026-04-30: 첫 release manifest 산출 — manifestHash `97079f5f…7c304ea3e8`, 5 components (git-sha + package-lock + python-requirements + sbom + soup) 동결. SOUP 23 entries (npm 8 / pypi 13 / model 2)
- 2026-04-30: V&V 결정성 테스트 36 → 43건 (TC-SEC-SI04-MANIFEST-001 / TC-RISK-012-001 / TC-PHI-013-001 / TC-AI-EVAL-014-001 / TC-CONSENT-015-001 / TC-CHANGE-016-001 / TC-IEC62304-001 신규)
- 2026-04-29: 디지털의료제품 관점의 클레임 잠금표 초안 작성
- 2026-04-29: `intended-use-and-contraindications.md` 작성. 1차 허가 범위를 뇌질환 이후 실어증·마비말장애 재활 보조 SaMD로 제한하고 MCI·치매 예방·자동 진단·자동 처방 클레임을 제외
- 2026-04-29: `risk-management-file.md` 작성. RM-001~RM-020 위험관리 매트릭스와 예비 SW 안전성 등급 Class B 준비 권고 정리
- 2026-04-29: 보호자 리포트 링크 보안 hardening 구현. 링크 만료 판정, 수동 폐기, 생성·접근·폐기 감사로그, 치료사 환자 권한 확인, `TC-RISK-002` V&V 추가
- 2026-04-29: STT 실패/빈 전사/서버 송신 차단의 `reviewRequired` 표준 상태 처리 구현. `sttReview.ts`, STT proxy 응답 필드, SpeechAnalyzer 결과 필드, `TC-RISK-001` V&V 추가
- 2026-04-29: 이상반응 리뷰 요약 및 V&V 구현. `adverseEventReview.ts`, adverse_events 테이블 자동 보장, `SR-AE-011`, `TC-RISK-003` 추가
- 2026-04-29: 환자 리포트 접근통제 V&V 구현. `patientReportAccess.ts` 정책 함수, 치료사 리포트 접근 판단 연결, `TC-RISK-004` 추가
- 2026-04-29: history 저장 실패 fallback 및 재시도 V&V 구현. compact/server-only fallback, 서버 재시도, 수동 검토 전환, 서버 결과 우선 재조회, `TC-RISK-005` 추가
- 2026-04-29: AI/STT 버전 메타데이터 V&V 구현. 결과 스냅샷에 STT 엔진, useCase, 정책 사유, prompt 버전·hash, 원본 음성 외부 전송 여부, review flag 기록, `TC-RISK-006` 추가
- 2026-04-29: `traceability-matrix.md` 작성. RM/SR/구현 파일/V&V/제출 증적 연결, Gaze/AAC Phase 1 적용 상태와 남은 통합 작업 정리
- 2026-04-29: `cloud-and-data-transfer.md` 작성. 안면·시선 온디바이스 범위, STT useCase별 서버 송신 정책, 외부 STT 전송 항목, 금지 클레임, P0 구현 상태 정리
- 2026-04-29: `ai-role-boundary.md` 작성. STT, 음향·조음, 안면, 시선, AAC, K-WAB, 보호자 리포트의 AI·알고리즘 역할을 의료진 보조 지표로 제한하고 금지 사용 문구 정리
- 2026-04-29: Gaze 리포트 저장/치료사 표시 구현. `TrainingHistoryEntry.gazeSummary`, 치료사 환자 상세 응시율·이탈·홍채 검출·샘플 표시, `TC-GAZE-003` V&V 추가
- 2026-04-29: AAC 주요 훈련 통합 구현. step-2, step-4, sentence-magic에 "말 대신 심볼" 토글 연결, `inputModality=aac` 결과 metadata 보존, `TC-AAC-002` V&V 추가
- 2026-04-29: STT client preflight 구현. game/daily training에서 WASM 미가용 + fallback off 상태면 `/api/proxy/stt` 업로드 전 차단, sentence-magic 직접 STT 호출 보강, `TC-STT-002` V&V 추가
- 2026-04-29: STT runtime 상태 분리. `mock_stt`, `wasm_whisper`, `server_whisper`, `disabled`를 `sttRuntime.ts`로 통합하고 `wasmSttAdapter.ts` 골격 추가, DEV_MODE는 실제 WASM이 아닌 mock으로 문서화, `TC-STT-003` V&V 추가
- 2026-05-04: STT 언어 정책 정리. 서버 STT의 클라이언트 `language` 요청값 수용 제거, `sttLanguage.ts`로 한국어 고정 (`ko` / `korean` / `ko-KR`) 및 `TC-STT-004` 추가. cloud/traceability 문서의 WASM-STT 상태를 “엔진 wiring 완료, 실측 RTF/WER 필요”로 정정
- 2026-05-04: WASM-STT 시험기관 협의용 사전 시험설계 메모를 작성했다. 현재 전략상 서버 STT 기본값으로 정리되면서 별도 규제 문서 세트에서는 제외했다.
