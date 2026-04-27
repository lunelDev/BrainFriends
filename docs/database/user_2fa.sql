-- docs/database/user_2fa.sql
--
-- 2FA(TOTP) secret 저장 테이블.
-- 정책:
--   - prescriber / admin 계정에 대해 강제 도입을 목표로 한다.
--   - 환자/치료사 계정은 옵션 (점진 도입).
--   - secret 은 32자 base32 — 별도 컬럼 암호화 도입 후 secret_enc 로 마이그레이션 예정.
--     초기 단계에서는 평문 저장하되 행 수가 매우 적고(처방자/관리자만)
--     접근이 server-side only 임을 전제한다.
--
-- 향후 확장:
--   - recovery_codes (복구 코드 1회용)
--   - hardware_token_id (FIDO2 도입 시)

CREATE TABLE IF NOT EXISTS user_2fa_totp (
  user_id UUID PRIMARY KEY,
  secret_base32 VARCHAR(64) NOT NULL,
  algorithm VARCHAR(16) NOT NULL DEFAULT 'SHA1',  -- TOTP 표준
  digits INT NOT NULL DEFAULT 6 CHECK (digits IN (6, 8)),
  period_sec INT NOT NULL DEFAULT 30,
  enabled_at TIMESTAMPTZ,                          -- NULL = pending(setup 단계)
  last_verified_at TIMESTAMPTZ,
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_2fa_totp_enabled_idx
  ON user_2fa_totp (enabled_at);
