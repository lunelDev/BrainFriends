CREATE TABLE IF NOT EXISTS organizations (
  organization_id UUID PRIMARY KEY,
  organization_name VARCHAR(150) NOT NULL,
  organization_code VARCHAR(50) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patient_pii (
  patient_id UUID PRIMARY KEY,
  patient_code VARCHAR(50) NOT NULL UNIQUE,
  full_name VARCHAR(100) NOT NULL,
  birth_date DATE,
  sex VARCHAR(20),
  phone VARCHAR(30),
  language VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE patient_pii
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(organization_id);

CREATE TABLE IF NOT EXISTS patient_intake_profiles (
  patient_id UUID PRIMARY KEY REFERENCES patient_pii(patient_id),
  education_years INTEGER NOT NULL DEFAULT 0,
  onset_date DATE,
  days_since_onset INTEGER,
  hemiplegia VARCHAR(10) NOT NULL DEFAULT 'N',
  hemianopsia VARCHAR(20) NOT NULL DEFAULT 'NONE',
  hand VARCHAR(10) NOT NULL DEFAULT 'U',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_users (
  user_id UUID PRIMARY KEY,
  patient_id UUID NOT NULL UNIQUE REFERENCES patient_pii(patient_id),
  user_role VARCHAR(20) NOT NULL DEFAULT 'patient',
  login_id VARCHAR(64) NOT NULL UNIQUE,
  login_key_hash VARCHAR(128) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(organization_id);

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS approval_state VARCHAR(20) NOT NULL DEFAULT 'approved';

CREATE TABLE IF NOT EXISTS auth_sessions (
  session_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_users(user_id),
  session_token_hash VARCHAR(128) NOT NULL UNIQUE,
  session_seed UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS therapist_patient_assignments (
  assignment_id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(organization_id),
  therapist_user_id UUID NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patient_pii(patient_id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES app_users(user_id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (therapist_user_id, patient_id)
);

CREATE TABLE IF NOT EXISTS patient_pseudonym_map (
  patient_pseudonym_id VARCHAR(64) PRIMARY KEY,
  patient_id UUID NOT NULL UNIQUE REFERENCES patient_pii(patient_id),
  mapping_version VARCHAR(50) NOT NULL DEFAULT 'pseudonym-map-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clinical_sessions (
  session_id UUID PRIMARY KEY,
  patient_pseudonym_id VARCHAR(64) NOT NULL REFERENCES patient_pseudonym_map(patient_pseudonym_id),
  training_type VARCHAR(50) NOT NULL,
  source_session_key VARCHAR(128),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  algorithm_version VARCHAR(50) NOT NULL,
  catalog_version VARCHAR(50),
  release_version VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'completed',
  version_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS language_training_results (
  result_id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES clinical_sessions(session_id),
  patient_pseudonym_id VARCHAR(64) NOT NULL REFERENCES patient_pseudonym_map(patient_pseudonym_id),
  training_mode VARCHAR(20) NOT NULL,
  rehab_step INTEGER,
  aq NUMERIC(6,2) NOT NULL,
  step_scores JSONB NOT NULL,
  step_details JSONB NOT NULL,
  articulation_scores JSONB,
  facial_analysis_snapshot JSONB,
  measurement_quality JSONB,
  step_version_snapshots JSONB,
  source_history_id VARCHAR(128) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clinical_media_objects (
  media_id UUID PRIMARY KEY,
  patient_pseudonym_id VARCHAR(64) NOT NULL REFERENCES patient_pseudonym_map(patient_pseudonym_id),
  source_session_key VARCHAR(128) NOT NULL,
  clinical_session_id UUID REFERENCES clinical_sessions(session_id),
  training_type VARCHAR(50) NOT NULL,
  step_no INTEGER,
  media_type VARCHAR(30) NOT NULL,
  capture_role VARCHAR(30) NOT NULL,
  bucket_name VARCHAR(100) NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  mime_type VARCHAR(100) NOT NULL,
  file_size_bytes BIGINT,
  duration_ms INTEGER,
  sha256_hash VARCHAR(128),
  captured_at TIMESTAMPTZ NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
);

  CREATE TABLE IF NOT EXISTS sing_results (
    result_id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES clinical_sessions(session_id),
    patient_pseudonym_id VARCHAR(64) NOT NULL REFERENCES patient_pseudonym_map(patient_pseudonym_id),
    song_key VARCHAR(100) NOT NULL,
    score NUMERIC(5,2) NOT NULL,
    jitter NUMERIC(6,3),
    facial_symmetry NUMERIC(6,3),
    latency_ms NUMERIC(8,2),
    consonant_accuracy NUMERIC(6,3),
    vowel_accuracy NUMERIC(6,3),
    lyric_accuracy NUMERIC(6,3),
    recognized_lyrics TEXT,
    comment TEXT,
    version_snapshot JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

CREATE TABLE IF NOT EXISTS training_client_drafts (
  user_id UUID NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
  storage_scope VARCHAR(10) NOT NULL,
  draft_key VARCHAR(200) NOT NULL,
  draft_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, storage_scope, draft_key)
);

CREATE TABLE IF NOT EXISTS training_usage_events (
  usage_event_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patient_pii(patient_id) ON DELETE CASCADE,
  patient_pseudonym_id VARCHAR(64) NOT NULL REFERENCES patient_pseudonym_map(patient_pseudonym_id),
  event_type VARCHAR(100) NOT NULL,
  event_status VARCHAR(20) NOT NULL DEFAULT 'success',
  training_type VARCHAR(50),
  step_no INTEGER,
  page_path VARCHAR(200),
  session_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

