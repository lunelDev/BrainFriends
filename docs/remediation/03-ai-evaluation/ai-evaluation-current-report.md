# AI 성능평가 현재 운영본 보고서

## 문서 정보

- 제품명: BrainFriends
- 범위: measured-only 평가셋 수집 및 버전 비교 운영 상태
- 기준 일자: 2026-04-15
- 검토 화면: `/therapist/system`, `/therapist/system/evaluation`

## 현재 제출형 기준

### 평가셋 포함 기준

- `quality = measured`
- transcript 존재
- tracking / processing 비교 필드 존재
- 다음 버전 필드 존재
  - `evaluationDatasetVersion`
  - `modelVersion`
  - `analysisVersion`

### 평가셋 제외 기준

- `demo` 샘플
- 정식 평가 기준의 `partial` 샘플
- transcript 누락 샘플
- 필수 버전 메타데이터 누락 샘플

## 저장 경로

- 기본 저장: PostgreSQL `ai_evaluation_samples`
- fallback 저장: `data/evaluation/evaluation-samples.ndjson`
- API 경로: `src/app/api/evaluation-samples/route.ts`
- 제출형 export 경로: `/api/therapist/system/ai-evaluation-export`

## 현재 운영에서 확인 가능한 항목

- 전체 샘플 수
- measured 샘플 수
- 최근 적재 시각
- dataset / model / analysis version 조합
- 버전별 평균 발음 / 자음 / 모음 / 추적 품질
- 최근 두 버전 delta
- 품질 분포
- 훈련 모드 분포

## 제출용 표 기준

1. 버전 비교표
2. 최근 버전 delta 표
3. 훈련 모드 분포표
4. 품질 분포표
5. 오류 사례 부록

## 현재 판단

AI 성능평가 항목은 **measured-only 평가셋 분리, DB 저장, 버전 비교, 운영 모니터링까지 확보된 상태**이며, 남은 작업은 외부 시험기관 양식에 맞춘 수치 표현과 부록 정리입니다.
