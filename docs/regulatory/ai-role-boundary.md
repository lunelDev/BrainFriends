# 브레인프렌즈 AI 역할 경계 문서 v0.1

작성일: 2026-04-29  
상위 문서: `claim-lock.md`, `intended-use-and-contraindications.md`, `risk-management-file.md`, `traceability-matrix.md`  
목적: 브레인프렌즈의 AI·알고리즘 출력이 진단·치료 결정을 대체하지 않고 의료진 검토를 보조하는 참고 지표임을 모듈별로 고정한다.

## 1. 결론

브레인프렌즈의 AI 및 알고리즘 기능은 자동 진단, 자동 처방, 치료 결정, 응급 판단을 수행하지 않는다.

모든 분석 결과는 다음 범위로 제한한다.

> 브레인프렌즈의 AI·알고리즘 분석 결과는 언어재활 훈련 수행 상태와 경과 확인을 돕는 참고 지표이며, 최종 평가·진단·치료 계획·처방 결정은 의료진이 수행한다.

## 2. 공통 원칙

| 원칙 | 내용 |
| --- | --- |
| 보조성 | 모든 출력은 의료진 검토를 위한 보조 지표다. |
| 비진단성 | 실어증, 마비말장애, 인지장애를 확정 진단하지 않는다. |
| 비처방성 | 훈련 종류, 강도, 빈도, 치료 방향을 자동 처방하지 않는다. |
| 검토 필요 | STT 실패, 측정 품질 저하, 급격한 점수 변화, 이상반응 발생 시 의료진 검토가 필요하다. |
| 설명 가능성 | 출력값은 입력 데이터, 품질 상태, 알고리즘 버전, review flag와 함께 해석해야 한다. |
| 변경관리 | 모델, prompt, scoring rule, threshold 변경 시 재검증과 문서 갱신이 필요하다. |

## 3. 모듈별 역할 경계

| 모듈 | 입력 | 출력 | 허용 사용 | 금지 사용 | 의료진 개입 지점 |
| --- | --- | --- | --- | --- | --- |
| STT | 음성 녹음 | transcript, confidence, sttStatus, reviewRequired | 과제 발화 전사 보조, 치료사 검토용 참고 | 발화 정확도 확정, 진단, 치료 결정 | 빈 전사, 실패, 서버 차단, 낮은 신뢰도, transcript-실제 발화 불일치 |
| 음향·조음 분석 | 음성, transcript, 과제 문장 | 발음·자모음 정확도, 음향 보조 지표 | 훈련 수행 상태 참고, 변화 추세 확인 | 말장애 진단 확정, 치료 효과 단독 판단 | 점수 급변, STT 실패, 녹음 품질 저하 |
| 안면 분석 | 얼굴 영상/랜드마크 | 입술 개폐, 구강 움직임, facial symmetry, 측정 품질 | 조음 관련 움직임 보조 지표 | 안면마비 또는 신경학적 질환 진단 | 조도·각도·얼굴 가림, no-face, 측정 품질 저하 |
| 시선 분석 | iris/eye landmark | gaze centered score, attentionRatio, offTaskRatio, measurementQuality | 과제 참여도 참고, 화면 응시 상태 확인 | 인지기능 진단, 주의력 장애 진단 | iris 미검출, 안경·조도 문제, off-task 급증 |
| AAC | 심볼 선택 sequence | 규칙형 한국어 문장, unknownIds | 발화 대체 입력, 사용자 선택 의도 기록 | AI 의도 예측, 환자 의사 확정 해석 | 보호자/치료사가 의미를 오해하거나 환자 의도와 다를 때 |
| K-WAB 보조 채점 | K-WAB 기반 과제 수행 결과 | 하위 점수, AQ 등 자동 계산값 | 치료사 검토용 채점 보조, 경과 확인 | 자동 진단, 최종 K-WAB 확정 판정 | 평가 과제 종료 후 치료사 검토 |
| 보호자 리포트 | 세션 요약, AQ 변화, 이상반응 건수 | read-only 주간 요약 | 경과 공유, 보호자 관찰 보조 | 치료효과 판단, 처방 변경, 보호자 단독 판단 | 보호자 문의, 급격한 변화, 이상반응 보고 |

## 4. STT 역할 경계

### 4.1 허용 역할

- 음성 과제의 발화를 텍스트로 전사한다.
- 발화 과제 채점과 치료사 검토를 위한 보조 입력으로 사용한다.
- useCase별로 서버 STT 허용 여부를 제한한다.
- 실패, 빈 전사, 서버 송신 차단은 `reviewRequired=true`로 표시한다.

### 4.2 금지 역할

- STT transcript만으로 발화 정확도를 확정하지 않는다.
- transcript를 질환 진단 근거로 단독 사용하지 않는다.
- STT 결과가 없는데도 정상 분석 완료처럼 표시하지 않는다.
- 전체 제품을 “원본 음성 미전송”으로 표현하지 않는다.

### 4.3 근거

| 항목 | 근거 |
| --- | --- |
| 정책 | `src/lib/speech/sttPolicy.ts` |
| 실패 분류 | `src/lib/speech/sttReview.ts` |
| prompt/version | `src/lib/speech/sttPrompt.ts`, `src/lib/analysis/versioning.ts` |
| V&V | TC-STT-001, TC-RISK-001, TC-RISK-006 |

## 5. 안면 분석 역할 경계

### 5.1 허용 역할

- 브라우저 내 MediaPipe FaceLandmarker로 얼굴 랜드마크를 추출한다.
- 입술 개폐, 구강 움직임, 조음 관련 보조 지표를 산출한다.
- 측정 품질과 fallback 상태를 함께 고려한다.

### 5.2 금지 역할

- 안면마비, 신경학적 손상, 구강운동장애를 확정 진단하지 않는다.
- 얼굴 움직임 지표만으로 치료 효과를 단독 판단하지 않는다.
- 조도·카메라 각도·얼굴 가림이 있는 결과를 확정값처럼 사용하지 않는다.

### 5.3 근거

| 항목 | 근거 |
| --- | --- |
| 구현 | `src/components/diagnosis/FaceTracker.tsx`, `src/utils/faceAnalysis.ts` |
| 요구사항 | SR-MEASURE-006 |
| V&V | TC-MQ-001 |

## 6. 시선 분석 역할 경계

### 6.1 허용 역할

- 홍채와 눈 주변 랜드마크를 바탕으로 화면 중앙 응시 정도를 계산한다.
- attentionRatio, offTaskRatio, irisDetectionRatio, measurementQuality를 산출한다.
- 과제 참여도와 측정 품질을 해석하는 보조 지표로 사용한다.

### 6.2 금지 역할

- 시선 지표만으로 인지기능, 주의력 장애, 의식 수준을 진단하지 않는다.
- off-task 지표를 환자 의지 또는 치료 순응도 판단으로 단독 사용하지 않는다.
- calibration 없는 gaze 값을 정밀 시선좌표처럼 주장하지 않는다.

### 6.3 근거

| 항목 | 근거 |
| --- | --- |
| 구현 | `src/utils/faceAnalysis.ts`, `src/lib/training/gazeAccumulator.ts`, `src/components/diagnosis/FaceTracker.tsx`, `src/lib/kwab/SessionManager.ts`, `src/app/therapist/patients/[patientId]/page.tsx` |
| 요구사항 | SR-GAZE-007 |
| V&V | TC-GAZE-001, TC-GAZE-002, TC-GAZE-003 |
| 남은 작업 | 9-point calibration, 정량 정확도 평가 |

## 7. AAC 역할 경계

### 7.1 허용 역할

- 사용자가 선택한 심볼 sequence를 규칙 기반 한국어 문장으로 변환한다.
- 발화가 어려운 환자의 대체 입력으로 사용한다.
- 서버에서 동일 sequence를 재계산해 저장한다.
- unknownIds를 기록해 알 수 없는 심볼 입력을 추적한다.

### 7.2 금지 역할

- 현재 AAC Phase 1을 AI 의도 예측으로 표현하지 않는다.
- 사용자가 선택하지 않은 의도를 추론했다고 주장하지 않는다.
- AAC 문장을 환자의 최종 의사표현으로 의료진 검토 없이 확정하지 않는다.

### 7.3 근거

| 항목 | 근거 |
| --- | --- |
| 구현 | `src/constants/aacData.ts`, `src/lib/aac/intentTemplate.ts`, `src/lib/aac/trainingIntegration.ts`, `src/components/aac/AACBoard.tsx`, `src/app/(training)/programs/step-2/page.tsx`, `src/app/(training)/programs/step-4/page.tsx`, `src/components/lingo/SentenceMagicGame.tsx`, `src/app/api/aac/intent/route.ts` |
| 요구사항 | SR-AAC-008 |
| V&V | TC-AAC-001, TC-AAC-002 |
| 남은 작업 | 사용 빈도 정렬, 치료사 화면 log 표시 |

## 8. K-WAB 보조 채점 역할 경계

### 8.1 허용 역할

- K-WAB 기반 하위 과제 결과를 자동 계산한다.
- AQ 등 점수 산출을 치료사 검토용으로 제공한다.
- 경과 변화와 훈련 계획 참고자료로 사용한다.

### 8.2 금지 역할

- K-WAB 자동 진단이라고 표현하지 않는다.
- 의료진 검토 없이 실어증 유형, 중증도, 치료 방향을 확정하지 않는다.
- 단일 세션 점수 변화만으로 치료 효과를 입증했다고 주장하지 않는다.

### 8.3 근거

| 항목 | 근거 |
| --- | --- |
| 구현 | `src/lib/kwab/KWABScoring.ts`, `src/app/api/kwab/final-result` |
| 요구사항 | SR-SCORE-004 |
| V&V | TC-SCORE-001 |

## 9. 표시·문구 원칙

### 9.1 UI/리포트에 권장되는 표현

| 상황 | 권장 문구 |
| --- | --- |
| STT 실패 | 음성 인식 결과를 확정할 수 없어 치료사 검토가 필요합니다. |
| 낮은 측정 품질 | 카메라·마이크 환경의 영향으로 측정 품질이 낮을 수 있습니다. |
| K-WAB 결과 | 자동 계산된 보조 점수이며 치료사 검토 후 해석해야 합니다. |
| 시선 지표 | 화면 응시 상태를 나타내는 참고 지표입니다. |
| AAC 문장 | 사용자가 선택한 심볼을 규칙에 따라 문장으로 변환한 결과입니다. |
| 보호자 리포트 | 경과 확인용 요약이며 치료 판단은 의료진에게 문의해야 합니다. |

### 9.2 금지 문구

- AI가 진단합니다.
- AI가 치료 방향을 결정합니다.
- 자동 K-WAB 진단 결과입니다.
- 시선 분석으로 인지 상태를 판정합니다.
- AAC AI가 환자 의도를 예측했습니다.
- 음성 분석으로 치료 효과가 입증되었습니다.
- 보호자 리포트만으로 치료 계획을 변경할 수 있습니다.

## 10. 의료진 검토 트리거

다음 조건에서는 치료사 또는 의사 검토가 필요하다.

| 트리거 | 관련 모듈 |
| --- | --- |
| `reviewRequired=true` | STT |
| 빈 transcript 또는 STT 실패 | STT |
| 측정 품질 `demo` 또는 `partial` | 안면, 시선, step 결과 |
| gaze offTaskRatio 급증 | 시선 |
| no-face 또는 iris 미검출 반복 | 안면, 시선 |
| K-WAB/AQ 급격한 변화 | K-WAB |
| 이상반응 보고 | 안전관리 |
| 보호자 문의 또는 불안 호소 | 보호자 리포트 |
| AAC 문장이 환자 의도와 다르게 보이는 경우 | AAC |

## 11. 위험관리 연결

| 위험 | 본 문서의 통제 |
| --- | --- |
| RM-001 STT 전사 오류 | STT 결과를 보조 전사로 제한하고 실패 시 reviewRequired 처리 |
| RM-004 시선 측정 실패 또는 오해 | 시선 지표를 참여도 참고 지표로 제한 |
| RM-005 K-WAB 보조 점수의 진단 오해 | 자동 진단 금지, 치료사 검토 명시 |
| RM-006 AAC 문장 생성 오해 | 규칙형 변환으로 제한, AI 예측 금지 |
| RM-013 AI 보조 지표의 과신 | 모든 AI·알고리즘 결과를 의료진 보조 지표로 제한 |
| RM-014 성능 수치 미검증 클레임 | 검증 전 정량 성능 확정 표현 금지 |
| RM-019 변경관리 부재 | version metadata와 재검증 트리거 연결 |

## 12. 문서 갱신 조건

다음 변경이 발생하면 본 문서를 갱신한다.

- WASM STT 엔진 실제 연결
- Whisper-ko 또는 자가호스팅 STT 모델 도입
- IRT/Bayesian Adaptive Testing 구현
- AAC ML intent classifier 도입
- K-WAB scoring rule 변경
- Gaze calibration UI 또는 정량 정확도 평가 추가
- AI 성능평가 데이터셋 결과 확정
- 식약처 사전상담 또는 보완 의견 수령

## 13. 다음 작업

다음 작업은 코드 기준으로는 AAC 로그의 치료사 화면 표시다.

우선순위는 다음과 같다.

1. Gaze 누적 리포트를 history payload와 치료사 화면에 표시
2. AAC를 step-2 또는 step-4에 “말 대신 심볼” 토글로 통합
3. STT 외부 서비스 고지 문구를 개인정보/동의 UI에 반영
