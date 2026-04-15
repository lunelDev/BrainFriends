# AI 성능평가 제출 개요

## 목적

일반 서비스 데이터와 measured-only 평가 샘플을 분리하고, 버전 및 거버넌스 상태를 런타임에서도 검토 가능하게 만드는 것이 목적입니다.

## 런타임 구조

measured-only 샘플 수집 및 거버넌스 연결 위치:

- `src/lib/ai/measurementCollector.ts`
- `src/lib/ai/evaluationDataset.ts`
- `src/lib/ai/modelGovernance.ts`
- `src/lib/server/evaluationSamplesDb.ts`

## 저장 전략

1차 저장:

- PostgreSQL 테이블 `ai_evaluation_samples`

fallback 저장:

- `data/evaluation/evaluation-samples.ndjson`

API 진입점:

- `src/app/api/evaluation-samples/route.ts`

## 필수 샘플 조건

정식 평가 검토 대상은 measured 품질 샘플만 포함합니다.

현재 런타임 수집 흐름은 아래 항목을 확인합니다.

- `quality = measured`
- transcript 존재
- tracking / processing 관련 필드 존재
- governance version 필드 존재

## 운영 검토 화면

- `/therapist/system`
- `/therapist/system/evaluation`

현재 화면에서 확인 가능한 항목:

- 전체 샘플 수
- measured 샘플 수
- 최근 적재 시각
- dataset / model / analysis version 조합
- 버전별 평균 발음 / 자음 / 모음 / 추적 품질
- 최근 버전 delta
- 품질 분포 및 훈련 모드 분포

## 권장 제출 패키지

1. 평가 데이터셋 정의서
2. 모델 거버넌스 / 버전 기록
3. 포함 / 제외 규칙 요약
4. 버전 비교표
5. 오류 사례 분석 요약

## 남은 작업

- 실제 시험기관 양식에 맞춰 지표 표기 형식을 조정
- 평가 프로토콜에서 요구하는 추가 지표가 있으면 반영
