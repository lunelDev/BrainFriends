/**
 * src/lib/server/userTotpDb.ts
 *
 * user_2fa_totp 테이블 리포지토리.
 * 정책:
 *   - prescriber / admin 강제, 그 외 옵션
 *   - secret 평문 저장(현 단계). 컬럼 암호화 도입 후 secret_enc 로 마이그레이션
 *   - 5회 연속 실패 시 5분 lockout
 */

import { getDbPool } from "@/lib/server/postgres";

export type UserTotpRow = {
  userId: string;
  secretBase32: string;
  algorithm: string;
  digits: number;
  periodSec: number;
  enabledAt: Date | null;
  lastVerifiedAt: Date | null;
  failedAttempts: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const FAILED_LOCK_THRESHOLD = 5;
const LOCK_DURATION_MS = 5 * 60 * 1000;

function isTotpStorageUnavailable(error: unknown) {
  const message =
    error instanceof Error ? error.message : String(error ?? "");
  return (
    message === "missing_database_url" ||
    /user_2fa_totp/.test(message) ||
    /ECONNREFUSED|ENOTFOUND|database|connect|timeout|terminating connection/i.test(
      message,
    )
  );
}

function rowToTotp(row: Record<string, unknown>): UserTotpRow {
  return {
    userId: String(row.user_id),
    secretBase32: String(row.secret_base32),
    algorithm: String(row.algorithm),
    digits: Number(row.digits),
    periodSec: Number(row.period_sec),
    enabledAt: row.enabled_at ? new Date(String(row.enabled_at)) : null,
    lastVerifiedAt: row.last_verified_at
      ? new Date(String(row.last_verified_at))
      : null,
    failedAttempts: Number(row.failed_attempts),
    lockedUntil: row.locked_until ? new Date(String(row.locked_until)) : null,
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

export async function getUserTotp(userId: string): Promise<UserTotpRow | null> {
  try {
    const pool = getDbPool();
    const r = await pool.query(
      `SELECT * FROM user_2fa_totp WHERE user_id = $1 LIMIT 1`,
      [userId],
    );
    return r.rows[0] ? rowToTotp(r.rows[0]) : null;
  } catch (error) {
    if (isTotpStorageUnavailable(error)) {
      return null;
    }
    throw error;
  }
}

export async function upsertPendingTotpSecret(input: {
  userId: string;
  secretBase32: string;
  algorithm?: string;
  digits?: number;
  periodSec?: number;
}): Promise<UserTotpRow> {
  const pool = getDbPool();
  const r = await pool.query(
    `
      INSERT INTO user_2fa_totp (
        user_id, secret_base32, algorithm, digits, period_sec,
        enabled_at, failed_attempts, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, NULL, 0, NOW(), NOW())
      ON CONFLICT (user_id) DO UPDATE
        SET secret_base32 = EXCLUDED.secret_base32,
            algorithm = EXCLUDED.algorithm,
            digits = EXCLUDED.digits,
            period_sec = EXCLUDED.period_sec,
            enabled_at = NULL,
            failed_attempts = 0,
            locked_until = NULL,
            updated_at = NOW()
      RETURNING *
    `,
    [
      input.userId,
      input.secretBase32,
      input.algorithm ?? "SHA1",
      input.digits ?? 6,
      input.periodSec ?? 30,
    ],
  );
  return rowToTotp(r.rows[0]);
}

export async function markTotpEnabled(userId: string): Promise<void> {
  const pool = getDbPool();
  await pool.query(
    `
      UPDATE user_2fa_totp
         SET enabled_at = NOW(),
             last_verified_at = NOW(),
             failed_attempts = 0,
             locked_until = NULL,
             updated_at = NOW()
       WHERE user_id = $1
    `,
    [userId],
  );
}

export async function recordTotpVerified(userId: string): Promise<void> {
  const pool = getDbPool();
  await pool.query(
    `
      UPDATE user_2fa_totp
         SET last_verified_at = NOW(),
             failed_attempts = 0,
             locked_until = NULL,
             updated_at = NOW()
       WHERE user_id = $1
    `,
    [userId],
  );
}

export async function recordTotpFailure(userId: string): Promise<UserTotpRow | null> {
  const pool = getDbPool();
  const r = await pool.query(
    `
      UPDATE user_2fa_totp
         SET failed_attempts = failed_attempts + 1,
             locked_until = CASE
               WHEN failed_attempts + 1 >= $2
                 THEN NOW() + ($3 || ' milliseconds')::interval
               ELSE locked_until
             END,
             updated_at = NOW()
       WHERE user_id = $1
       RETURNING *
    `,
    [userId, FAILED_LOCK_THRESHOLD, String(LOCK_DURATION_MS)],
  );
  return r.rows[0] ? rowToTotp(r.rows[0]) : null;
}

export async function disableTotp(userId: string): Promise<void> {
  const pool = getDbPool();
  await pool.query(`DELETE FROM user_2fa_totp WHERE user_id = $1`, [userId]);
}

export function isLockedNow(row: UserTotpRow, now = new Date()): boolean {
  if (!row.lockedUntil) return false;
  return row.lockedUntil.getTime() > now.getTime();
}
