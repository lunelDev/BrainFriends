/**
 * 신규 `user_pii_profile` 테이블 전용 리포지토리.
 *
 * 용도
 *   - 환자/회원의 추가 PII (생년월일, 성별, 언어) 저장
 *   - 레거시 patient_pii 와의 매핑 추적용 컬럼(legacy_patient_code/id) 포함
 *
 * 주의
 *   - 치료사/관리자도 이 테이블에 행을 가질 수 있지만 일반적으로는 회원(USER)만 사용
 *   - user_id 는 users(id) 를 ON DELETE CASCADE 로 참조하므로 계정 삭제 시 함께 제거
 */
import type { PoolClient } from "pg";
import { getDbPool } from "@/lib/server/postgres";

export type UserPiiProfileRow = {
  userId: string;
  birthDate: string | null; // ISO date 'YYYY-MM-DD'
  sex: string | null; // M / F / U (레거시 호환)
  language: string | null;
  legacyPatientCode: string | null;
  legacyPatientId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UpsertUserPiiProfileInput = {
  userId: string;
  birthDate?: string | null;
  sex?: string | null;
  language?: string | null;
  legacyPatientCode?: string | null;
  legacyPatientId?: string | null;
};

function rowToProfile(row: Record<string, unknown>): UserPiiProfileRow {
  const birthDateRaw = row.birth_date;
  return {
    userId: String(row.user_id),
    birthDate: birthDateRaw
      ? birthDateRaw instanceof Date
        ? birthDateRaw.toISOString().slice(0, 10)
        : String(birthDateRaw).slice(0, 10)
      : null,
    sex: row.sex ? String(row.sex) : null,
    language: row.language ? String(row.language) : null,
    legacyPatientCode: row.legacy_patient_code ? String(row.legacy_patient_code) : null,
    legacyPatientId: row.legacy_patient_id ? String(row.legacy_patient_id) : null,
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

export async function upsertUserPiiProfile(
  client: PoolClient,
  input: UpsertUserPiiProfileInput,
): Promise<UserPiiProfileRow> {
  const result = await client.query(
    `
      INSERT INTO user_pii_profile (
        user_id, birth_date, sex, language,
        legacy_patient_code, legacy_patient_id,
        created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6, NOW(), NOW())
      ON CONFLICT (user_id) DO UPDATE
      SET
        birth_date = EXCLUDED.birth_date,
        sex = EXCLUDED.sex,
        language = EXCLUDED.language,
        legacy_patient_code = COALESCE(EXCLUDED.legacy_patient_code, user_pii_profile.legacy_patient_code),
        legacy_patient_id   = COALESCE(EXCLUDED.legacy_patient_id,   user_pii_profile.legacy_patient_id),
        updated_at = NOW()
      RETURNING *
    `,
    [
      input.userId,
      input.birthDate ?? null,
      input.sex ?? null,
      input.language ?? null,
      input.legacyPatientCode ?? null,
      input.legacyPatientId ?? null,
    ],
  );
  return rowToProfile(result.rows[0]);
}

export async function getUserPiiProfileByUserId(
  client: PoolClient,
  userId: string,
): Promise<UserPiiProfileRow | null> {
  const result = await client.query(
    `SELECT * FROM user_pii_profile WHERE user_id = $1`,
    [userId],
  );
  return result.rows[0] ? rowToProfile(result.rows[0]) : null;
}

export async function getUserPiiProfileByLegacyPatientId(
  client: PoolClient,
  legacyPatientId: string,
): Promise<UserPiiProfileRow | null> {
  const result = await client.query(
    `SELECT * FROM user_pii_profile WHERE legacy_patient_id = $1`,
    [legacyPatientId],
  );
  return result.rows[0] ? rowToProfile(result.rows[0]) : null;
}

/** 편의 래퍼 — 자체 트랜잭션 */
export async function upsertUserPiiProfileStandalone(
  input: UpsertUserPiiProfileInput,
): Promise<UserPiiProfileRow> {
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const row = await upsertUserPiiProfile(client, input);
    await client.query("COMMIT");
    return row;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
