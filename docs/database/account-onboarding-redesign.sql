-- BrainFriends 계정 / 기관 / 소속 / 매칭 재설계 (통일안 v2)
--
-- 개정 이력
-- 2026-04-21: docs/decisions/2026-04-21-unified-target-schema.md 의 §9 결정 반영
--   - users에 login_key_hash, last_login_at, legacy_user_role 추가
--   - institution_members.role에 PATIENT 허용
--   - institutions 의 business_number / representative_name / institution_type
--     / address1 / business_license_file_url 를 NULLABLE 로 완화
--     (승인 전환 시점에 앱 레벨에서 완전성 체크)
--   - user_pii_profile (환자/회원용 추가 PII) 신설
--   - clinical_patient_profiles (재활 배경, pseudonym 키) 신설
--   - patient_pseudonym_map 에 user_id 추가 (patient_id 와 공존, 단계적 전환)
--
-- 이 파일은 여러 번 실행해도 안전하도록 전부 IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- 구조로 작성되어 있음. 기존 레거시 테이블(app_users, patient_pii,
-- patient_intake_profiles, organizations, therapist_patient_assignments 등)은
-- 전혀 건드리지 않는다.

-- ─────────────────────────────────────────────
-- 1. 신원 계층
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(30) NOT NULL UNIQUE,
    login_id VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    login_key_hash VARCHAR(128) UNIQUE,
    account_type VARCHAR(20) NOT NULL, -- USER / THERAPIST / ADMIN
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING / ACTIVE / SUSPENDED
    legacy_user_role VARCHAR(20), -- 마이그 추적용 (app_users.user_role)
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS login_key_hash VARCHAR(128);
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS legacy_user_role VARCHAR(20);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_login_key_hash_key'
    ) THEN
        BEGIN
            ALTER TABLE users
                ADD CONSTRAINT users_login_key_hash_key UNIQUE (login_key_hash);
        EXCEPTION WHEN duplicate_table THEN
            -- 이미 존재
            NULL;
        END;
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS user_pii_profile (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    birth_date DATE,
    sex VARCHAR(20),
    language VARCHAR(20),
    legacy_patient_code VARCHAR(50) UNIQUE, -- 마이그 추적용 (patient_pii.patient_code)
    legacy_patient_id UUID UNIQUE,          -- 마이그 추적용 (patient_pii.patient_id)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 2. 치료사 프로파일
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS therapist_profiles (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_type VARCHAR(50) NOT NULL,
    license_number VARCHAR(100) NOT NULL,
    license_file_url TEXT NOT NULL,
    issued_by VARCHAR(100),
    issued_date DATE,
    specialty TEXT,
    introduction TEXT,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    verification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING / APPROVED / REJECTED
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 3. 기관
--    레거시 organizations 에 없던 컬럼은 NULLABLE 로 완화.
--    "status='APPROVED' 로 전환하려면 이 컬럼들이 모두 채워져 있어야 한다"는
--    제약은 앱 레벨(관리자 승인 액션)에서 강제한다.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS institutions (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    business_number VARCHAR(30) UNIQUE,
    representative_name VARCHAR(100),
    institution_type VARCHAR(50),
    medical_org_number VARCHAR(50),
    phone VARCHAR(30),
    zip_code VARCHAR(10),
    address1 VARCHAR(255),
    address2 VARCHAR(255),
    business_license_file_url TEXT,
    opening_license_file_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING / APPROVED / REJECTED
    created_by_user_id UUID REFERENCES users(id),
    legacy_organization_id UUID UNIQUE, -- 마이그 추적용 (organizations.organization_id)
    legacy_organization_code VARCHAR(50) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE institutions
    ADD COLUMN IF NOT EXISTS legacy_organization_id UUID;
ALTER TABLE institutions
    ADD COLUMN IF NOT EXISTS legacy_organization_code VARCHAR(50);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'institutions_legacy_org_id_key'
    ) THEN
        BEGIN
            ALTER TABLE institutions
                ADD CONSTRAINT institutions_legacy_org_id_key UNIQUE (legacy_organization_id);
        EXCEPTION WHEN duplicate_table THEN NULL;
        END;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'institutions_legacy_org_code_key'
    ) THEN
        BEGIN
            ALTER TABLE institutions
                ADD CONSTRAINT institutions_legacy_org_code_key UNIQUE (legacy_organization_code);
        EXCEPTION WHEN duplicate_table THEN NULL;
        END;
    END IF;
END$$;

-- ─────────────────────────────────────────────
-- 4. 소속 · 매칭
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS institution_members (
    id UUID PRIMARY KEY,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- OWNER / MANAGER / THERAPIST / PATIENT
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING / APPROVED / REJECTED
    is_owner BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (institution_id, user_id, role)
);

CREATE TABLE IF NOT EXISTS user_therapist_mappings (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    therapist_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING / APPROVED / REJECTED / ENDED
    assigned_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 5. 매핑 · 임상 배경
--    patient_pseudonym_map 은 기존 레거시 테이블이지만
--    user_id 컬럼을 추가하여 신규 users 와 연결한다.
--    기존 patient_id 컬럼은 제거하지 않고 공존시킨 뒤,
--    마이그레이션 완료 후 별도 단계에서 제거 예정.
--
--    clinical_patient_profiles 는 신설. 키를 patient_pseudonym_id 로 두어
--    PHI 분리 원칙을 따른다.
-- ─────────────────────────────────────────────

ALTER TABLE IF EXISTS patient_pseudonym_map
    ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE REFERENCES users(id);

CREATE TABLE IF NOT EXISTS clinical_patient_profiles (
    patient_pseudonym_id VARCHAR(64) PRIMARY KEY
        REFERENCES patient_pseudonym_map(patient_pseudonym_id) ON DELETE CASCADE,
    education_years INTEGER NOT NULL DEFAULT 0,
    onset_date DATE,
    days_since_onset INTEGER,
    hemiplegia VARCHAR(10) NOT NULL DEFAULT 'N',
    hemianopsia VARCHAR(20) NOT NULL DEFAULT 'NONE',
    hand VARCHAR(10) NOT NULL DEFAULT 'U',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 6. 인덱스
-- ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_account_type
    ON users(account_type, status);

CREATE INDEX IF NOT EXISTS idx_users_legacy_role
    ON users(legacy_user_role);

CREATE INDEX IF NOT EXISTS idx_therapist_profiles_verification
    ON therapist_profiles(verification_status, is_public);

CREATE INDEX IF NOT EXISTS idx_therapist_profiles_user
    ON therapist_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_institutions_status
    ON institutions(status);

CREATE INDEX IF NOT EXISTS idx_institution_members_lookup
    ON institution_members(institution_id, role, status);

CREATE INDEX IF NOT EXISTS idx_institution_members_user
    ON institution_members(user_id, role, status);

CREATE INDEX IF NOT EXISTS idx_user_therapist_mappings_lookup
    ON user_therapist_mappings(therapist_user_id, user_id, status);

CREATE INDEX IF NOT EXISTS idx_user_therapist_mappings_user
    ON user_therapist_mappings(user_id, status);

CREATE INDEX IF NOT EXISTS idx_pseudonym_map_user
    ON patient_pseudonym_map(user_id);
