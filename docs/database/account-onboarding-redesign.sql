-- BrainFriends 계정 / 기관 / 소속 / 매칭 재설계 초안
-- 목적:
-- 1. 기관은 조직 엔티티로 분리
-- 2. 치료사 / 일반 회원은 사람 계정으로 분리
-- 3. 치료사의 기관 소속 승인과 사용자-치료사 매칭을 별도 상태로 관리

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL UNIQUE,
    login_id VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    account_type VARCHAR(20) NOT NULL, -- USER / THERAPIST / ADMIN
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING / ACTIVE / SUSPENDED
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS therapist_profiles (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
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

CREATE TABLE IF NOT EXISTS institutions (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    business_number VARCHAR(30) NOT NULL UNIQUE,
    representative_name VARCHAR(100) NOT NULL,
    institution_type VARCHAR(50) NOT NULL,
    medical_org_number VARCHAR(50),
    phone VARCHAR(20),
    zip_code VARCHAR(10),
    address1 VARCHAR(255) NOT NULL,
    address2 VARCHAR(255),
    business_license_file_url TEXT NOT NULL,
    opening_license_file_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING / APPROVED / REJECTED
    created_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS institution_members (
    id UUID PRIMARY KEY,
    institution_id UUID NOT NULL REFERENCES institutions(id),
    user_id UUID NOT NULL REFERENCES users(id),
    role VARCHAR(20) NOT NULL, -- OWNER / MANAGER / THERAPIST
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING / APPROVED / REJECTED
    is_owner BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (institution_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_therapist_mappings (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    therapist_user_id UUID NOT NULL REFERENCES users(id),
    institution_id UUID NOT NULL REFERENCES institutions(id),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING / APPROVED / REJECTED / ENDED
    assigned_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_account_type
    ON users(account_type, status);

CREATE INDEX IF NOT EXISTS idx_therapist_profiles_verification
    ON therapist_profiles(verification_status, is_public);

CREATE INDEX IF NOT EXISTS idx_institution_members_lookup
    ON institution_members(institution_id, role, status);

CREATE INDEX IF NOT EXISTS idx_user_therapist_mappings_lookup
    ON user_therapist_mappings(therapist_user_id, user_id, status);
