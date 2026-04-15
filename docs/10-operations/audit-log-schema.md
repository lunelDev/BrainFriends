# Audit Log Schema Draft

이 문서는 MFDS SaMD 허가 준비를 위한 감사로그(audit log) 초안 스키마입니다.
현재 코드 초안은 append-only NDJSON 파일(`data/audit/clinical-events.ndjson`)에 기록하며,
권장 운영 구조는 append-only object storage 또는 변경 불가능한 보관 스토리지입니다.

## 1. 로그 스키마

필수 필드:
- `audit_event_id`: 감사 이벤트 고유 식별자
- `event_type`: 이벤트 종류
- `status`: `success | failed | skipped | rejected`
- `timestamp`: 이벤트 발생 시각(UTC ISO-8601)
- `patient_pseudonym_id`: 직접식별자를 제거한 환자 가명 ID
- `session_id`: 세션 식별자
- `operator_user_role`: `patient | therapist | admin | system`
- `pipeline_stage`: `step1~6 | sing`
- `device_info`: 브라우저/플랫폼/언어/IP metadata
- `raw_input_metadata`: 입력 종류, 오디오 부착 여부, 곡 key 등
- `preprocessing_version`: 전처리 버전
- `feature_values`: 주요 feature 값
- `final_scores`: 최종 점수 묶음
- `threshold_decision`: threshold 통과/실패 판단
- `algorithm_versions`: 공통 version snapshot
- `failure_reason`: 실패 또는 skip 원인
- `storage_targets`: 실제 저장 위치 목록

## 2. 저장 위치 제안

개발 초안:
- `data/audit/clinical-events.ndjson`
- 목적: append-only, 로컬 디버깅, V&V 증적 확인

권장 운영 구조:
- 1차 저장: append-only NDJSON 또는 전용 로그 수집 파이프라인
- 2차 보관: append-only object storage 또는 WORM 스토리지
- 운영 원칙: 애플리케이션 수정 경로와 로그 수정 경로를 분리

## 3. 예시 JSON

```json
{
  "audit_event_id": "audit_0e0f5f7e9c6f6f1a7d80",
  "event_type": "sing_training_result_persist",
  "status": "success",
  "timestamp": "2026-03-13T09:12:44.120Z",
  "patient_pseudonym_id": "psn_8e31f4b2f2c86d90",
  "session_id": "4d4efc55-7b18-4dc8-a2a9-ef7a2e6f3d47",
  "operator_user_role": "patient",
  "pipeline_stage": "sing",
  "device_info": {
    "userAgent": "Mozilla/5.0 ...",
    "platform": "Windows",
    "acceptLanguage": "ko-KR",
    "ipAddress": null
  },
  "raw_input_metadata": {
    "inputKind": "multimodal",
    "audioEncoding": "audio/webm",
    "reviewAudioAttached": true,
    "songKey": "나비야"
  },
  "preprocessing_version": "brain-sing-audio-video-preprocessing-v1",
  "feature_values": {
    "jitter_percent": 0.31,
    "facial_symmetry_index": 96.4,
    "reaction_latency_ms": 118
  },
  "final_scores": {
    "overall_score": 93,
    "jitter_percent": 0.31,
    "facial_symmetry_index": 96.4
  },
  "threshold_decision": {
    "ruleName": "brain-sing-score-pass-threshold",
    "threshold": 70,
    "comparator": ">=",
    "observedValue": 93,
    "passed": true
  },
  "algorithm_versions": {
    "algorithm_version": "brain-sing-analysis-v1",
    "feature_schema_version": "brain-sing-feature-schema-v1",
    "scoring_rule_version": "brain-sing-score-v1",
    "model_version": "brain-sing-sim-v1",
    "release_version": "golden-2026.03.13",
    "pipeline_name": "brain-karaoke-analysis",
    "pipeline_stage": "sing",
    "generated_at": "2026-03-13T09:12:42.904Z",
    "requirements": ["SAMD-SING-001", "SAMD-FACE-001", "SAMD-TRACE-001"]
  },
  "failure_reason": null,
  "storage_targets": [
    "postgres:patient_pii",
    "postgres:clinical_sessions",
    "postgres:sing_results",
    "data/audit/clinical-events.ndjson"
  ]
}
```

## 4. 코드 구현안

현재 추가된 코드 초안:
- `src/lib/server/auditLog.ts`
  - 공통 audit log 타입
  - patient pseudonym 생성
  - Request 기반 device info 추출
  - sing-training audit event builder
  - append-only NDJSON 기록
- `src/app/api/sing-results/route.ts`
  - `success / failed / skipped / rejected` 상태별 audit event 기록

## 5. 개인정보 최소화 원칙 반영 여부

반영 항목:
- 환자 이름/전화번호 원문을 audit log에 직접 기록하지 않음
- `patient_pseudonym_id`는 가명화된 해시 기반 식별자 사용
- raw input은 원본 데이터 전체가 아니라 metadata만 기록
- device/browser 정보는 운영 및 보안 검토에 필요한 최소값만 기록
- score/feature/threshold는 재현성에 필요한 수준으로만 기록

미반영/향후 보완:
- pseudonym mapping table 분리 저장
- audit log DB 저장 시 암호화/권한 분리
- therapist/admin role 구분 입력
- step1~6 공통 audit adapter 확장


