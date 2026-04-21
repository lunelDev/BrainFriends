/**
 * 신규 `institutions` 테이블 전용 리포지토리.
 *
 * 설계 원칙
 *   - 레거시 organizations 와 동일한 개념. legacy_organization_id / code 로 연결.
 *   - business_number/representative_name/institution_type/address1/
 *     business_license_file_url 는 NULLABLE 이다. status='APPROVED' 전환은
 *     관리자 승인 액션에서 앱 레벨로 완전성 체크 후에 수행한다.
 */
import { randomUUID } from "crypto";
import type { PoolClient } from "pg";
import { getDbPool } from "@/lib/server/postgres";

export type InstitutionStatus = "PENDING" | "APPROVED" | "REJECTED";

export type InstitutionRow = {
  id: string;
  name: string;
  businessNumber: string | null;
  representativeName: string | null;
  institutionType: string | null;
  medicalOrgNumber: string | null;
  phone: string | null;
  zipCode: string | null;
  address1: string | null;
  address2: string | null;
  businessLicenseFileUrl: string | null;
  openingLicenseFileUrl: string | null;
  status: InstitutionStatus;
  createdByUserId: string | null;
  legacyOrganizationId: string | null;
  legacyOrganizationCode: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UpsertInstitutionInput = {
  id?: string;
  name: string;
  businessNumber?: string | null;
  representativeName?: string | null;
  institutionType?: string | null;
  medicalOrgNumber?: string | null;
  phone?: string | null;
  zipCode?: string | null;
  address1?: string | null;
  address2?: string | null;
  businessLicenseFileUrl?: string | null;
  openingLicenseFileUrl?: string | null;
  status?: InstitutionStatus;
  createdByUserId?: string | null;
  legacyOrganizationId?: string | null;
  legacyOrganizationCode?: string | null;
};

function rowToInstitution(row: Record<string, unknown>): InstitutionRow {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    businessNumber: row.business_number ? String(row.business_number) : null,
    representativeName: row.representative_name ? String(row.representative_name) : null,
    institutionType: row.institution_type ? String(row.institution_type) : null,
    medicalOrgNumber: row.medical_org_number ? String(row.medical_org_number) : null,
    phone: row.phone ? String(row.phone) : null,
    zipCode: row.zip_code ? String(row.zip_code) : null,
    address1: row.address1 ? String(row.address1) : null,
    address2: row.address2 ? String(row.address2) : null,
    businessLicenseFileUrl: row.business_license_file_url
      ? String(row.business_license_file_url)
      : null,
    openingLicenseFileUrl: row.opening_license_file_url
      ? String(row.opening_license_file_url)
      : null,
    status: String(row.status ?? "PENDING") as InstitutionStatus,
    createdByUserId: row.created_by_user_id ? String(row.created_by_user_id) : null,
    legacyOrganizationId: row.legacy_organization_id ? String(row.legacy_organization_id) : null,
    legacyOrganizationCode: row.legacy_organization_code ? String(row.legacy_organization_code) : null,
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

export async function upsertInstitution(
  client: PoolClient,
  input: UpsertInstitutionInput,
): Promise<InstitutionRow> {
  // legacy id 로 먼저 조회해서 존재하면 그 id 를 재사용, 없으면 새 id
  let resolvedId = input.id;
  if (!resolvedId && input.legacyOrganizationId) {
    const existing = await client.query(
      `SELECT id FROM institutions WHERE legacy_organization_id = $1 LIMIT 1`,
      [input.legacyOrganizationId],
    );
    resolvedId = existing.rows[0]?.id;
  }
  if (!resolvedId) resolvedId = randomUUID();

  const result = await client.query(
    `
      INSERT INTO institutions (
        id, name, business_number, representative_name, institution_type,
        medical_org_number, phone, zip_code, address1, address2,
        business_license_file_url, opening_license_file_url,
        status, created_by_user_id,
        legacy_organization_id, legacy_organization_code,
        created_at, updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,$10,
        $11,$12,
        $13,$14,
        $15,$16,
        NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE
      SET
        name = EXCLUDED.name,
        business_number = EXCLUDED.business_number,
        representative_name = EXCLUDED.representative_name,
        institution_type = EXCLUDED.institution_type,
        medical_org_number = EXCLUDED.medical_org_number,
        phone = EXCLUDED.phone,
        zip_code = EXCLUDED.zip_code,
        address1 = EXCLUDED.address1,
        address2 = EXCLUDED.address2,
        business_license_file_url = EXCLUDED.business_license_file_url,
        opening_license_file_url = EXCLUDED.opening_license_file_url,
        status = EXCLUDED.status,
        created_by_user_id = COALESCE(EXCLUDED.created_by_user_id, institutions.created_by_user_id),
        legacy_organization_id = COALESCE(EXCLUDED.legacy_organization_id, institutions.legacy_organization_id),
        legacy_organization_code = COALESCE(EXCLUDED.legacy_organization_code, institutions.legacy_organization_code),
        updated_at = NOW()
      RETURNING *
    `,
    [
      resolvedId,
      input.name,
      input.businessNumber ?? null,
      input.representativeName ?? null,
      input.institutionType ?? null,
      input.medicalOrgNumber ?? null,
      input.phone ?? null,
      input.zipCode ?? null,
      input.address1 ?? null,
      input.address2 ?? null,
      input.businessLicenseFileUrl ?? null,
      input.openingLicenseFileUrl ?? null,
      input.status ?? "PENDING",
      input.createdByUserId ?? null,
      input.legacyOrganizationId ?? null,
      input.legacyOrganizationCode ?? null,
    ],
  );
  return rowToInstitution(result.rows[0]);
}

export async function getInstitutionById(
  client: PoolClient,
  id: string,
): Promise<InstitutionRow | null> {
  const result = await client.query(`SELECT * FROM institutions WHERE id = $1`, [id]);
  return result.rows[0] ? rowToInstitution(result.rows[0]) : null;
}

export async function getInstitutionByLegacyId(
  client: PoolClient,
  legacyOrganizationId: string,
): Promise<InstitutionRow | null> {
  const result = await client.query(
    `SELECT * FROM institutions WHERE legacy_organization_id = $1 LIMIT 1`,
    [legacyOrganizationId],
  );
  return result.rows[0] ? rowToInstitution(result.rows[0]) : null;
}

export async function setInstitutionStatus(
  client: PoolClient,
  id: string,
  status: InstitutionStatus,
): Promise<void> {
  await client.query(
    `UPDATE institutions SET status = $1, updated_at = NOW() WHERE id = $2`,
    [status, id],
  );
}

/** 편의 래퍼 */
export async function upsertInstitutionStandalone(
  input: UpsertInstitutionInput,
): Promise<InstitutionRow> {
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const row = await upsertInstitution(client, input);
    await client.query("COMMIT");
    return row;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
