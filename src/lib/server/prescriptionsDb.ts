/**
 * src/lib/server/prescriptionsDb.ts
 *
 * DTx 처방(prescription) 리포지토리.
 * 기존 historyQueries.ts / clinicalResultsDb.ts 와 동일한 getDbPool() 패턴.
 *
 * 흐름:
 *   1) 의사/관리자 → createPrescription() → status='pending' + 코드 발급
 *   2) 환자 → redeemPrescription(code, patientUserId) → status='active'
 *   3) /programs/* 진입 시 → getActivePrescriptionForPatient()
 *   4) 만료 체크는 read 시점에 동적으로 (cron 없음). expiredAt < NOW() 면 expired 취급.
 */

import { randomBytes, randomUUID } from "crypto";
import type { PoolClient } from "pg";
import { getDbPool } from "@/lib/server/postgres";

export type PrescriptionStatus =
  | "pending"
  | "active"
  | "expired"
  | "revoked"
  | "completed";

export type PrescriptionRow = {
  id: string;
  code: string;
  patientUserId: string;
  patientPseudonymId: string;
  prescriberUserId: string;
  programScope: string[];
  durationWeeks: number;
  sessionsPerWeek: number;
  sessionMinutes: number;
  startsAt: Date;
  expiresAt: Date;
  status: PrescriptionStatus;
  redeemedAt: Date | null;
  revokedAt: Date | null;
  revokedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreatePrescriptionInput = {
  patientUserId: string;
  patientPseudonymId: string;
  prescriberUserId: string;
  programScope: string[];
  durationWeeks: number;
  sessionsPerWeek: number;
  sessionMinutes: number;
  startsAt?: Date;
};

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // O, 0, I, 1 제외 (혼동 방지)
const CODE_LENGTH = 8;

function generatePrescriptionCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

function rowToPrescription(row: Record<string, unknown>): PrescriptionRow {
  return {
    id: String(row.id),
    code: String(row.code),
    patientUserId: String(row.patient_user_id),
    patientPseudonymId: String(row.patient_pseudonym_id),
    prescriberUserId: String(row.prescriber_user_id),
    programScope: Array.isArray(row.program_scope)
      ? (row.program_scope as string[])
      : [],
    durationWeeks: Number(row.duration_weeks),
    sessionsPerWeek: Number(row.sessions_per_week),
    sessionMinutes: Number(row.session_minutes),
    startsAt: new Date(String(row.starts_at)),
    expiresAt: new Date(String(row.expires_at)),
    status: String(row.status) as PrescriptionStatus,
    redeemedAt: row.redeemed_at ? new Date(String(row.redeemed_at)) : null,
    revokedAt: row.revoked_at ? new Date(String(row.revoked_at)) : null,
    revokedReason: row.revoked_reason ? String(row.revoked_reason) : null,
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/** 요청한 횟수만큼 code 충돌 시 재시도 후 포기 */
async function insertWithUniqueCode(
  client: PoolClient,
  input: CreatePrescriptionInput,
  maxAttempts = 5,
): Promise<PrescriptionRow> {
  const startsAt = input.startsAt ?? new Date();
  const expiresAt = new Date(
    startsAt.getTime() + input.durationWeeks * 7 * 24 * 60 * 60 * 1000,
  );

  let lastError: unknown = null;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = generatePrescriptionCode();
    try {
      const result = await client.query(
        `
          INSERT INTO prescriptions (
            id, code,
            patient_user_id, patient_pseudonym_id, prescriber_user_id,
            program_scope,
            duration_weeks, sessions_per_week, session_minutes,
            starts_at, expires_at,
            status, created_at, updated_at
          )
          VALUES (
            $1, $2,
            $3, $4, $5,
            $6,
            $7, $8, $9,
            $10, $11,
            'pending', NOW(), NOW()
          )
          RETURNING *
        `,
        [
          randomUUID(),
          code,
          input.patientUserId,
          input.patientPseudonymId,
          input.prescriberUserId,
          input.programScope,
          input.durationWeeks,
          input.sessionsPerWeek,
          input.sessionMinutes,
          startsAt.toISOString(),
          expiresAt.toISOString(),
        ],
      );
      return rowToPrescription(result.rows[0]);
    } catch (err: unknown) {
      lastError = err;
      // 23505 = unique_violation (code 충돌). 그 외 에러는 바로 포기.
      const code = (err as { code?: string })?.code;
      if (code !== "23505") throw err;
    }
  }
  throw lastError ?? new Error("prescription_code_collision");
}

export async function createPrescription(
  input: CreatePrescriptionInput,
): Promise<PrescriptionRow> {
  if (input.durationWeeks <= 0 || input.durationWeeks > 52) {
    throw new Error("invalid_duration_weeks");
  }
  if (input.sessionsPerWeek <= 0 || input.sessionsPerWeek > 14) {
    throw new Error("invalid_sessions_per_week");
  }
  if (input.sessionMinutes <= 0 || input.sessionMinutes > 240) {
    throw new Error("invalid_session_minutes");
  }
  if (!input.programScope.length) {
    throw new Error("empty_program_scope");
  }

  const pool = getDbPool();
  const client = await pool.connect();
  try {
    return await insertWithUniqueCode(client, input);
  } finally {
    client.release();
  }
}

/**
 * 환자의 "현재 유효한" 처방 1건 (status='active' AND expires_at > NOW()).
 * 여러 건 있으면 가장 최근 redeemed_at 우선.
 */
export async function getActivePrescriptionForPatient(
  patientUserId: string,
): Promise<PrescriptionRow | null> {
  const pool = getDbPool();
  const result = await pool.query(
    `
      SELECT *
        FROM prescriptions
       WHERE patient_user_id = $1
         AND status = 'active'
         AND expires_at > NOW()
       ORDER BY redeemed_at DESC NULLS LAST, created_at DESC
       LIMIT 1
    `,
    [patientUserId],
  );
  return result.rows[0] ? rowToPrescription(result.rows[0]) : null;
}

/**
 * 코드로 조회 — redeem 전 pending 상태도 찾을 수 있어야 한다.
 * 소유권 체크는 상위에서 (patient_user_id 비교).
 */
export async function getPrescriptionByCode(
  code: string,
): Promise<PrescriptionRow | null> {
  const pool = getDbPool();
  const result = await pool.query(
    `SELECT * FROM prescriptions WHERE code = $1 LIMIT 1`,
    [code.toUpperCase().trim()],
  );
  return result.rows[0] ? rowToPrescription(result.rows[0]) : null;
}

export async function getPrescriptionById(
  id: string,
): Promise<PrescriptionRow | null> {
  const pool = getDbPool();
  const result = await pool.query(
    `SELECT * FROM prescriptions WHERE id = $1 LIMIT 1`,
    [id],
  );
  return result.rows[0] ? rowToPrescription(result.rows[0]) : null;
}

/**
 * 환자가 코드 입력 → 본인 소유 확인 후 active 전환.
 * - 이미 active 면 그대로 반환 (멱등)
 * - expired/revoked/completed 면 에러
 * - 소유자 불일치면 에러 (다른 환자의 코드)
 */
export async function redeemPrescription(input: {
  code: string;
  patientUserId: string;
}): Promise<PrescriptionRow> {
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const lookup = await client.query(
      `SELECT * FROM prescriptions WHERE code = $1 FOR UPDATE`,
      [input.code.toUpperCase().trim()],
    );
    const row = lookup.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      throw new Error("prescription_not_found");
    }

    if (String(row.patient_user_id) !== input.patientUserId) {
      await client.query("ROLLBACK");
      throw new Error("prescription_owner_mismatch");
    }

    const status = String(row.status);
    if (status === "active") {
      await client.query("COMMIT");
      return rowToPrescription(row);
    }
    if (status !== "pending") {
      await client.query("ROLLBACK");
      throw new Error(`prescription_not_redeemable_${status}`);
    }

    const expiresAt = new Date(String(row.expires_at));
    if (expiresAt.getTime() <= Date.now()) {
      await client.query(
        `UPDATE prescriptions SET status='expired', updated_at=NOW() WHERE id=$1`,
        [row.id],
      );
      await client.query("COMMIT");
      throw new Error("prescription_already_expired");
    }

    const updated = await client.query(
      `
        UPDATE prescriptions
           SET status='active',
               redeemed_at = NOW(),
               updated_at = NOW()
         WHERE id = $1
         RETURNING *
      `,
      [row.id],
    );
    await client.query("COMMIT");
    return rowToPrescription(updated.rows[0]);
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* noop */
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function revokePrescription(input: {
  id: string;
  reason?: string;
}): Promise<PrescriptionRow | null> {
  const pool = getDbPool();
  const result = await pool.query(
    `
      UPDATE prescriptions
         SET status='revoked',
             revoked_at = NOW(),
             revoked_reason = $2,
             updated_at = NOW()
       WHERE id = $1
         AND status IN ('pending','active')
       RETURNING *
    `,
    [input.id, input.reason ?? null],
  );
  return result.rows[0] ? rowToPrescription(result.rows[0]) : null;
}

export async function listPrescriptionsByPrescriber(
  prescriberUserId: string,
  opts?: { limit?: number },
): Promise<PrescriptionRow[]> {
  const pool = getDbPool();
  const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 500);
  const result = await pool.query(
    `
      SELECT * FROM prescriptions
       WHERE prescriber_user_id = $1
       ORDER BY created_at DESC
       LIMIT $2
    `,
    [prescriberUserId, limit],
  );
  return result.rows.map(rowToPrescription);
}

export async function listPrescriptionsForPatient(
  patientUserId: string,
  opts?: { limit?: number },
): Promise<PrescriptionRow[]> {
  const pool = getDbPool();
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
  const result = await pool.query(
    `
      SELECT * FROM prescriptions
       WHERE patient_user_id = $1
       ORDER BY created_at DESC
       LIMIT $2
    `,
    [patientUserId, limit],
  );
  return result.rows.map(rowToPrescription);
}
