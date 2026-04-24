-- docs/database/prescriptions.sql
--
-- DTx 처방 시스템 테이블 정의.
-- 기존 language_training_results / therapist_patient_assignments 는 그대로 두고
-- 그 위에 얹는다.
--
-- 핵심 개념:
-- - prescriptions 1건 = "의사가 환자에게 N주간 특정 프로그램 처방"
-- - 환자는 redeem 단계를 거쳐야 status='active' 가 되고, 그 이후에만
--   /programs/* 진입이 허용된다 (서버 게이트).
-- - prescription_sessions 는 개별 학습 세션 실행 기록 (adherence 계산용).
--
-- FK:
-- - patient_pseudonym_id → patient_pseudonym_map.patient_pseudonym_id
--   (기존 language_training_results 와 동일 조인 키)
-- - patient_user_id / prescriber_user_id 는 app_users.user_id 의 UUID 와 동일 타입.
--   FK 는 아직 걸지 않는다 (app_users 와 users 이중 스키마 이행 중이라
--   양쪽 모두를 허용하는 가벼운 연결로 둔다).

CREATE TABLE IF NOT EXISTS prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(16) UNIQUE NOT NULL,
  patient_user_id UUID NOT NULL,
  patient_pseudonym_id VARCHAR(64) NOT NULL
    REFERENCES patient_pseudonym_map(patient_pseudonym_id),
  prescriber_user_id UUID NOT NULL,
  program_scope TEXT[] NOT NULL,
  duration_weeks INT NOT NULL CHECK (duration_weeks > 0 AND duration_weeks <= 52),
  sessions_per_week INT NOT NULL CHECK (sessions_per_week > 0 AND sessions_per_week <= 14),
  session_minutes INT NOT NULL CHECK (session_minutes > 0 AND session_minutes <= 240),
  starts_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  redeemed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('pending', 'active', 'expired', 'revoked', 'completed')),
  CHECK (expires_at > starts_at)
);

CREATE INDEX IF NOT EXISTS prescriptions_patient_status_idx
  ON prescriptions (patient_user_id, status);
CREATE INDEX IF NOT EXISTS prescriptions_pseudonym_status_idx
  ON prescriptions (patient_pseudonym_id, status);
CREATE INDEX IF NOT EXISTS prescriptions_prescriber_idx
  ON prescriptions (prescriber_user_id);

CREATE TABLE IF NOT EXISTS prescription_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  training_result_id UUID,
  program_code VARCHAR(50) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_sec INT,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  week_index INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS prescription_sessions_rx_week_idx
  ON prescription_sessions (prescription_id, week_index);
CREATE INDEX IF NOT EXISTS prescription_sessions_result_idx
  ON prescription_sessions (training_result_id);
