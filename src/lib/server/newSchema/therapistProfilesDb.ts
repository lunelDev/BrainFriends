/**
 * 신규 `therapist_profiles` 테이블 전용 리포지토리.
 *
 * 용도
 *   - 치료사 라이선스 / 소개 / 공개 여부 / 관리자 승인 상태
 *   - 레거시 therapist_registration_profiles.json 을 점진적으로 대체
 */
import { randomUUID } from "crypto";
import type { PoolClient } from "pg";
import { getDbPool } from "@/lib/server/postgres";

export type TherapistVerificationStatus = "PENDING" | "APPROVED" | "REJECTED";

export type TherapistProfileRow = {
  id: string;
  userId: string;
  jobType: string;
  licenseNumber: string;
  licenseFileUrl: string;
  issuedBy: string | null;
  issuedDate: string | null;
  specialty: string | null;
  introduction: string | null;
  isPublic: boolean;
  verificationStatus: TherapistVerificationStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type UpsertTherapistProfileInput = {
  /** 없으면 신규 UUID 발급 */
  id?: string;
  userId: string;
  jobType: string;
  licenseNumber: string;
  licenseFileUrl: string;
  issuedBy?: string | null;
  issuedDate?: string | null;
  specialty?: string | null;
  introduction?: string | null;
  isPublic?: boolean;
  verificationStatus?: TherapistVerificationStatus;
};

function rowToProfile(row: Record<string, unknown>): TherapistProfileRow {
  const issuedDate = row.issued_date;
  return {
    id: String(row.id),
    userId: String(row.user_id),
    jobType: String(row.job_type ?? ""),
    licenseNumber: String(row.license_number ?? ""),
    licenseFileUrl: String(row.license_file_url ?? ""),
    issuedBy: row.issued_by ? String(row.issued_by) : null,
    issuedDate: issuedDate
      ? issuedDate instanceof Date
        ? issuedDate.toISOString().slice(0, 10)
        : String(issuedDate).slice(0, 10)
      : null,
    specialty: row.specialty ? String(row.specialty) : null,
    introduction: row.introduction ? String(row.introduction) : null,
    isPublic: Boolean(row.is_public),
    verificationStatus: String(row.verification_status ?? "PENDING") as TherapistVerificationStatus,
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/** 같은 user_id 로 들어오면 업데이트, 없으면 생성 */
export async function upsertTherapistProfile(
  client: PoolClient,
  input: UpsertTherapistProfileInput,
): Promise<TherapistProfileRow> {
  const existing = await client.query(
    `SELECT id FROM therapist_profiles WHERE user_id = $1 LIMIT 1`,
    [input.userId],
  );
  const id = existing.rows[0]?.id ?? input.id ?? randomUUID();

  const result = await client.query(
    `
      INSERT INTO therapist_profiles (
        id, user_id, job_type, license_number, license_file_url,
        issued_by, issued_date, specialty, introduction,
        is_public, verification_status,
        created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE
      SET
        job_type = EXCLUDED.job_type,
        license_number = EXCLUDED.license_number,
        license_file_url = EXCLUDED.license_file_url,
        issued_by = EXCLUDED.issued_by,
        issued_date = EXCLUDED.issued_date,
        specialty = EXCLUDED.specialty,
        introduction = EXCLUDED.introduction,
        is_public = EXCLUDED.is_public,
        verification_status = EXCLUDED.verification_status,
        updated_at = NOW()
      RETURNING *
    `,
    [
      id,
      input.userId,
      input.jobType,
      input.licenseNumber,
      input.licenseFileUrl,
      input.issuedBy ?? null,
      input.issuedDate ?? null,
      input.specialty ?? null,
      input.introduction ?? null,
      input.isPublic ?? false,
      input.verificationStatus ?? "PENDING",
    ],
  );
  return rowToProfile(result.rows[0]);
}

export async function getTherapistProfileByUserId(
  client: PoolClient,
  userId: string,
): Promise<TherapistProfileRow | null> {
  const result = await client.query(
    `SELECT * FROM therapist_profiles WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  return result.rows[0] ? rowToProfile(result.rows[0]) : null;
}

export async function setTherapistVerificationStatus(
  client: PoolClient,
  id: string,
  status: TherapistVerificationStatus,
): Promise<void> {
  await client.query(
    `UPDATE therapist_profiles
        SET verification_status = $1, updated_at = NOW()
      WHERE id = $2`,
    [status, id],
  );
}

/** 편의 래퍼 */
export async function upsertTherapistProfileStandalone(
  input: UpsertTherapistProfileInput,
): Promise<TherapistProfileRow> {
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const row = await upsertTherapistProfile(client, input);
    await client.query("COMMIT");
    return row;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
