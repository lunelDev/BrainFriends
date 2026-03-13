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
  comment TEXT,
  version_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  audit_log_id UUID PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  patient_pseudonym_id VARCHAR(64),
  session_id VARCHAR(100),
  operator_user_role VARCHAR(30) NOT NULL,
  pipeline_stage VARCHAR(50) NOT NULL,
  device_info JSONB NOT NULL,
  raw_input_metadata JSONB NOT NULL,
  preprocessing_version VARCHAR(100),
  feature_values JSONB NOT NULL,
  final_scores JSONB NOT NULL,
  threshold_decision JSONB,
  algorithm_versions JSONB,
  failure_reason TEXT,
  storage_targets JSONB NOT NULL DEFAULT '[]'::jsonb
);

