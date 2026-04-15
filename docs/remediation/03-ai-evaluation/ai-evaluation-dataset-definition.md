# AI 평가 데이터셋 정의서

## 목적

BrainFriends 런타임 샘플 중 어떤 데이터가 정식 AI 성능평가 검토 대상인지 정의합니다.

## 데이터셋 범위

주요 평가 범위:

- measured-only 음성 / 안면 샘플
- dataset, model, analysis version 기준으로 버전 관리
- 일반 서비스 history와 분리된 평가셋

현재 저장 경로:

- DB 우선: `ai_evaluation_samples`
- fallback: `data/evaluation/evaluation-samples.ndjson`

## 포함 규칙

다음 조건을 만족할 때 평가셋 수집 대상으로 봅니다.

1. `quality = measured`
2. transcript 존재
3. tracking / processing 비교 필드 존재
4. 다음 버전 필드 존재
   - `evaluationDatasetVersion`
   - `modelVersion`
   - `analysisVersion`

## 제외 규칙

다음 샘플은 제외합니다.

- `demo` 샘플
- 정식 평가셋 기준의 `partial` 샘플
- transcript가 없는 샘플
- 필수 버전 메타데이터가 없는 샘플

## 저장 필드

| 필드 | 의미 |
| --- | --- |
| `source_history_id` | 원본 history 연결값 |
| `source_session_id` | 원본 session 연결값 |
| `patient_pseudonym_id` | 가명화된 사용자 식별값 |
| `training_mode` | self / rehab / sing |
| `rehab_step` | 재활 step 번호 |
| `utterance_id` | 샘플 단위 식별값 |
| `quality` | measured / partial / demo |
| `prompt_text` | 목표 문장 또는 prompt |
| `transcript_text` | 인식 transcript |
| `consonant_accuracy` | 자음 정확도 |
| `vowel_accuracy` | 모음 정확도 |
| `pronunciation_score` | 발음 점수 |
| `symmetry_score` | 안면 대칭 점수 |
| `tracking_quality` | 추적 품질 |
| `processing_ms` | 처리 시간 |
| `fps` | 실행 fps |
| `model_version` | 모델 버전 |
| `analysis_version` | 분석 버전 |
| `evaluation_dataset_version` | 평가 데이터셋 버전 |

## 런타임 검토 화면

운영 검토 화면:

- `/therapist/system`
- `/therapist/system/evaluation`

현재 화면에서 보는 항목:

- 전체 샘플 수
- measured 샘플 수
- 버전 조합 표
- 최근 두 버전 delta
- 훈련 모드 분포
- 품질 분포

## 제출 시 추가 권장 항목

1. transcript / 자음 / 모음 / 안면 기준의 gold-label 정의
2. 기기 / 환경 분리 기준
3. 오류 사례 부록
4. 시험기관 양식에 맞춘 최종 지표표
