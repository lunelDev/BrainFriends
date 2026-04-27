-- docs/database/adverse_events.sql
--
-- 이상반응(Adverse Event, AE) 수집 테이블.
-- DTx/SaMD IRB 신청 및 시판 후 안전관리 필수 항목.
--
-- 정책:
--   - 환자 본인 신고 우선. 의사가 면담 중 대신 입력하는 케이스도 허용.
--   - 심각도 1(경미) ~ 3(중대). 3 이상이면 처방자 알림 (Phase 2).
--   - free_text 는 컬럼 암호화 도입 후 *_enc 로 마이그레이션 예정.

CREATE TABLE IF NOT EXISTS adverse_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id UUID NOT NULL,
  patient_pseudonym_id VARCHAR(64) NOT NULL
    REFERENCES patient_pseudonym_map(patient_pseudonym_id),
  prescription_id UUID,                          -- NULL 가능 (처방 없는 시점 발생)
  reporter_user_id UUID NOT NULL,                -- 신고자 (본인 또는 처방자)
  reporter_role VARCHAR(20) NOT NULL,            -- patient / prescriber / therapist / admin
  category VARCHAR(40) NOT NULL,                 -- headache, fatigue, dizziness, voice_fatigue, eye_fatigue, other
  severity SMALLINT NOT NULL CHECK (severity BETWEEN 1 AND 3),
  free_text TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  prescriber_acknowledged_at TIMESTAMPTZ,
  prescriber_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS adverse_events_patient_idx
  ON adverse_events (patient_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS adverse_events_prescription_idx
  ON adverse_events (prescription_id);
CREATE INDEX IF NOT EXISTS adverse_events_severity_idx
  ON adverse_events (severity, occurred_at DESC);
CREATE INDEX IF NOT EXISTS adverse_events_unack_severe_idx
  ON adverse_events (severity, prescriber_acknowledged_at)
  WHERE severity = 3 AND prescriber_acknowledged_at IS NULL;
