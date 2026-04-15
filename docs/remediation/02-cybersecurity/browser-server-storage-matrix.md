# 브라우저 / 서버 저장 항목표

## 목적

이 문서는 BrainFriends가 실행 중 데이터를 어디에 저장하는지 제출 관점에서 정리한 표입니다.

## 저장 영역

| 구분 | 저장 위치 | 키 / 테이블 | 예시 내용 | 민감도 | 현재 정책 |
| --- | --- | --- | --- | --- | --- |
| compact training session | 브라우저 `localStorage` | `kwab_training_session:*` | step 요약, AQ 관련 진행 상태, compact session snapshot | 중간 | 요약 상태만 허용, 원시 미디어 금지 |
| transient step review data | 브라우저 `sessionStorage` | `step_review:*` | step1~6 임시 review payload, 원시 미디어 제거 상태 | 중간 | 세션 범위로만 허용 |
| resume metadata | 브라우저 `sessionStorage` | `<stepKey>__meta` | signature, updatedAt, count | 낮음 | 세션 범위로만 허용 |
| exit progress | 브라우저 `sessionStorage` | `kwab_training_exit_progress` | currentStep, completedThroughStep, updatedAt | 낮음 | 세션 범위로만 허용 |
| device preference | 브라우저 `localStorage` | camera/audio preference keys | 선택한 입력 장치 ID | 낮음 | 허용 |
| security blocked-write count | 브라우저 `sessionStorage` | `security.blockedWriteCount` | 차단된 쓰기 횟수 | 낮음 | 운영용으로만 허용 |
| language result history | 브라우저 `localStorage` | `kwab_history:*` | 원시 미디어가 제거된 compact history 행 | 중간 | compact fallback cache로 허용 |
| clinical training results | 서버 DB | `language_training_results` | 저장된 결과, step 점수, step details, metadata | 높음 | 1차 저장소 |
| clinical sessions | 서버 DB | `clinical_sessions` | session 연결 정보, 시각, 훈련 유형 | 높음 | 1차 저장소 |
| sing training results | 서버 DB | `sing_results` | 점수, transcript, media reference, governance | 높음 | 1차 저장소 |
| AI evaluation samples | 서버 DB | `ai_evaluation_samples` | measured-only 평가 샘플 | 높음 | 1차 저장소 |
| security audit | 서버 파일 | `data/security/security-audit.ndjson` | 차단된 쓰기 / 보안 이벤트 기록 | 중간 | 운영 감사 로그 |
| therapist notes | 서버 파일 | `data/therapist/patient-notes.json` | 치료사 메모 / follow-up 상태 | 중간 | 현재 단계에서는 서버 운영 저장으로 허용 |
| evaluation fallback | 서버 파일 | `data/evaluation/evaluation-samples.ndjson` | 평가 샘플 fallback 기록 | 높음 | fallback 전용 |

## 이미 브라우저 장기 저장에서 제외된 고위험 payload

아래 step 키는 더 이상 브라우저에 원시 상태로 장기 저장하지 않습니다.

- `step1_data`
- `step2_recorded_audios`
- `step3_data`
- `step4_recorded_audios`
- `step5_recorded_data`
- `step6_recorded_data`

현재 처리 위치:

- `src/lib/security/transientStepStorage.ts`
- `src/app/(training)/programs/*`

## 최종 정책 메모

1. compact session cache는 요약 상태만 유지되고 원시 미디어 필드는 포함되지 않는 조건으로 허용
2. therapist note는 현재 remediation 범위에서는 서버 파일 기반 운영 저장으로 허용
3. legacy local fallback read는 전환기 호환 경로이며, 마이그레이션 검증 후 제거 대상
