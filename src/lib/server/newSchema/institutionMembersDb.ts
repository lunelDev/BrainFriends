/**
 * 신규 `institution_members` 테이블 전용 리포지토리.
 *
 * 용도
 *   - 기관-사용자 소속 관계. (institution_id, user_id, role) 로 UNIQUE.
 *   - role: OWNER / MANAGER / THERAPIST / PATIENT
 *   - status: PENDING / APPROVED / REJECTED
 */
import { randomUUID } from "crypto";
import type { PoolClient } from "pg";
import { getDbPool } from "@/lib/server/postgres";

export type InstitutionMemberRole = "OWNER" | "MANAGER" | "THERAPIST" | "PATIENT";
export type InstitutionMemberStatus = "PENDING" | "APPROVED" | "REJECTED";

export type InstitutionMemberRow = {
  id: string;
  institutionId: string;
  userId: string;
  role: InstitutionMemberRole;
  status: InstitutionMemberStatus;
  isOwner: boolean;
  joinedAt: Date | null;
  createdAt: Date;
};

export type UpsertInstitutionMemberInput = {
  id?: string;
  institutionId: string;
  userId: string;
  role: InstitutionMemberRole;
  status?: InstitutionMemberStatus;
  isOwner?: boolean;
  joinedAt?: Date | null;
};

function rowToMember(row: Record<string, unknown>): InstitutionMemberRow {
  return {
    id: String(row.id),
    institutionId: String(row.institution_id),
    userId: String(row.user_id),
    role: String(row.role) as InstitutionMemberRole,
    status: String(row.status ?? "PENDING") as InstitutionMemberStatus,
    isOwner: Boolean(row.is_owner),
    joinedAt: row.joined_at ? new Date(String(row.joined_at)) : null,
    createdAt: new Date(String(row.created_at)),
  };
}

/**
 * (institution_id, user_id, role) UNIQUE 제약을 이용해 멱등 삽입.
 */
export async function upsertInstitutionMember(
  client: PoolClient,
  input: UpsertInstitutionMemberInput,
): Promise<InstitutionMemberRow> {
  const id = input.id ?? randomUUID();

  const result = await client.query(
    `
      INSERT INTO institution_members (
        id, institution_id, user_id, role, status, is_owner, joined_at, created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7, NOW())
      ON CONFLICT (institution_id, user_id, role) DO UPDATE
      SET
        status = EXCLUDED.status,
        is_owner = EXCLUDED.is_owner,
        joined_at = COALESCE(EXCLUDED.joined_at, institution_members.joined_at)
      RETURNING *
    `,
    [
      id,
      input.institutionId,
      input.userId,
      input.role,
      input.status ?? "PENDING",
      input.isOwner ?? false,
      input.joinedAt ?? null,
    ],
  );
  return rowToMember(result.rows[0]);
}

export async function listMembersByInstitution(
  client: PoolClient,
  institutionId: string,
): Promise<InstitutionMemberRow[]> {
  const result = await client.query(
    `SELECT * FROM institution_members
      WHERE institution_id = $1
      ORDER BY created_at ASC`,
    [institutionId],
  );
  return result.rows.map(rowToMember);
}

export async function listMembershipsByUser(
  client: PoolClient,
  userId: string,
): Promise<InstitutionMemberRow[]> {
  const result = await client.query(
    `SELECT * FROM institution_members
      WHERE user_id = $1
      ORDER BY created_at ASC`,
    [userId],
  );
  return result.rows.map(rowToMember);
}

export async function setInstitutionMemberStatus(
  client: PoolClient,
  id: string,
  status: InstitutionMemberStatus,
): Promise<void> {
  await client.query(
    `UPDATE institution_members
        SET status = $1,
            joined_at = CASE WHEN $1 = 'APPROVED' AND joined_at IS NULL THEN NOW() ELSE joined_at END
      WHERE id = $2`,
    [status, id],
  );
}

/** 편의 래퍼 */
export async function upsertInstitutionMemberStandalone(
  input: UpsertInstitutionMemberInput,
): Promise<InstitutionMemberRow> {
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const row = await upsertInstitutionMember(client, input);
    await client.query("COMMIT");
    return row;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
