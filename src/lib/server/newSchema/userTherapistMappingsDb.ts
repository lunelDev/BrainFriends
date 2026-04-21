/**
 * 신규 `user_therapist_mappings` 테이블 전용 리포지토리.
 *
 * 용도
 *   - 환자(user_id) ↔ 치료사(therapist_user_id) 매칭 관계
 *   - 특정 institution_id 안에서 성립
 *   - status: PENDING / APPROVED / REJECTED / ENDED
 *
 * 레거시 대응
 *   - 기존 therapist_patient_assignments 와 병행. 이 테이블은 user.id 참조,
 *     레거시는 app_users.user_id + patient_pii.patient_id 참조.
 */
import { randomUUID } from "crypto";
import type { PoolClient } from "pg";
import { getDbPool } from "@/lib/server/postgres";

export type UserTherapistMappingStatus = "PENDING" | "APPROVED" | "REJECTED" | "ENDED";

export type UserTherapistMappingRow = {
  id: string;
  userId: string;
  therapistUserId: string;
  institutionId: string;
  status: UserTherapistMappingStatus;
  assignedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
};

export type UpsertUserTherapistMappingInput = {
  id?: string;
  userId: string;
  therapistUserId: string;
  institutionId: string;
  status?: UserTherapistMappingStatus;
  assignedAt?: Date | null;
  endedAt?: Date | null;
};

function rowToMapping(row: Record<string, unknown>): UserTherapistMappingRow {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    therapistUserId: String(row.therapist_user_id),
    institutionId: String(row.institution_id),
    status: String(row.status ?? "PENDING") as UserTherapistMappingStatus,
    assignedAt: row.assigned_at ? new Date(String(row.assigned_at)) : null,
    endedAt: row.ended_at ? new Date(String(row.ended_at)) : null,
    createdAt: new Date(String(row.created_at)),
  };
}

/**
 * (user_id, therapist_user_id, institution_id) 조합이 이미 있으면 재사용.
 * 외부에서 status 를 지정하면 업데이트, 없으면 유지.
 */
export async function upsertUserTherapistMapping(
  client: PoolClient,
  input: UpsertUserTherapistMappingInput,
): Promise<UserTherapistMappingRow> {
  const existing = await client.query(
    `SELECT id FROM user_therapist_mappings
      WHERE user_id = $1
        AND therapist_user_id = $2
        AND institution_id = $3
      LIMIT 1`,
    [input.userId, input.therapistUserId, input.institutionId],
  );

  if (existing.rows[0]?.id) {
    const id = String(existing.rows[0].id);
    const updateResult = await client.query(
      `UPDATE user_therapist_mappings
          SET status = COALESCE($1, status),
              assigned_at = COALESCE($2, assigned_at),
              ended_at = COALESCE($3, ended_at)
        WHERE id = $4
        RETURNING *`,
      [input.status ?? null, input.assignedAt ?? null, input.endedAt ?? null, id],
    );
    return rowToMapping(updateResult.rows[0]);
  }

  const id = input.id ?? randomUUID();
  const insertResult = await client.query(
    `
      INSERT INTO user_therapist_mappings (
        id, user_id, therapist_user_id, institution_id,
        status, assigned_at, ended_at, created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7, NOW())
      RETURNING *
    `,
    [
      id,
      input.userId,
      input.therapistUserId,
      input.institutionId,
      input.status ?? "PENDING",
      input.assignedAt ?? null,
      input.endedAt ?? null,
    ],
  );
  return rowToMapping(insertResult.rows[0]);
}

export async function listMappingsByUser(
  client: PoolClient,
  userId: string,
): Promise<UserTherapistMappingRow[]> {
  const result = await client.query(
    `SELECT * FROM user_therapist_mappings WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  return result.rows.map(rowToMapping);
}

export async function listMappingsByTherapist(
  client: PoolClient,
  therapistUserId: string,
): Promise<UserTherapistMappingRow[]> {
  const result = await client.query(
    `SELECT * FROM user_therapist_mappings WHERE therapist_user_id = $1 ORDER BY created_at DESC`,
    [therapistUserId],
  );
  return result.rows.map(rowToMapping);
}

export async function setMappingStatus(
  client: PoolClient,
  id: string,
  status: UserTherapistMappingStatus,
): Promise<void> {
  await client.query(
    `UPDATE user_therapist_mappings
        SET status = $1,
            assigned_at = CASE WHEN $1 = 'APPROVED' AND assigned_at IS NULL THEN NOW() ELSE assigned_at END,
            ended_at = CASE WHEN $1 = 'ENDED' AND ended_at IS NULL THEN NOW() ELSE ended_at END
      WHERE id = $2`,
    [status, id],
  );
}

/** 편의 래퍼 */
export async function upsertUserTherapistMappingStandalone(
  input: UpsertUserTherapistMappingInput,
): Promise<UserTherapistMappingRow> {
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const row = await upsertUserTherapistMapping(client, input);
    await client.query("COMMIT");
    return row;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
