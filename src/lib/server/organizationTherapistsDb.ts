import { getDbPool } from "@/lib/server/postgres";
import { listTherapistRegistrationProfiles } from "@/lib/server/therapistRegistrationProfiles";

export type OrganizationTherapistEntry = {
  therapistUserId: string;
  therapistName: string;
  loginId: string | null;
  organizationId: string | null;
  profession: string | null;
};

async function hasOrganizationsColumn() {
  const pool = getDbPool();
  const result = await pool.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'app_users'
          AND column_name = 'organization_id'
      ) AS exists
    `,
  );
  return Boolean(result.rows[0]?.exists);
}

async function hasApprovalStateColumn() {
  const pool = getDbPool();
  const result = await pool.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'app_users'
          AND column_name = 'approval_state'
      ) AS exists
    `,
  );
  return Boolean(result.rows[0]?.exists);
}

export async function listApprovedTherapistsByOrganization(
  organizationId: string,
) {
  const normalizedOrganizationId = String(organizationId ?? "").trim();
  if (!normalizedOrganizationId) {
    return [] satisfies OrganizationTherapistEntry[];
  }

  const canUseOrganizationId = await hasOrganizationsColumn();
  const canUseApprovalState = await hasApprovalStateColumn();
  const pool = getDbPool();
  const byUserId = new Map<string, OrganizationTherapistEntry>();
  const profiles = await listTherapistRegistrationProfiles();
  const profileByUserId = new Map(
    profiles.map((item) => [item.userId, item]),
  );

  if (canUseOrganizationId) {
    const result = await pool.query(
      `
        SELECT
          u.user_id::text AS therapist_user_id,
          pii.full_name AS therapist_name,
          u.login_id,
          u.organization_id::text AS organization_id
        FROM app_users u
        JOIN patient_pii pii ON pii.patient_id = u.patient_id
        WHERE u.user_role = 'therapist'
          AND u.organization_id = $1::uuid
          ${canUseApprovalState ? "AND COALESCE(u.approval_state, 'approved') = 'approved'" : ""}
        ORDER BY pii.full_name ASC
      `,
      [normalizedOrganizationId],
    );

    for (const row of result.rows as any[]) {
      byUserId.set(String(row.therapist_user_id), {
        therapistUserId: String(row.therapist_user_id),
        therapistName: String(row.therapist_name),
        loginId: row.login_id ? String(row.login_id) : null,
        organizationId: row.organization_id ? String(row.organization_id) : null,
        profession: profileByUserId.get(String(row.therapist_user_id))?.profession ?? null,
      });
    }
  }

  const fallbackUserIds = profiles
    .filter((item) => item.organizationId === normalizedOrganizationId)
    .map((item) => item.userId)
    .filter((userId) => !byUserId.has(userId));

  if (fallbackUserIds.length) {
    const fallbackResult = await pool.query(
      `
        SELECT
          u.user_id::text AS therapist_user_id,
          pii.full_name AS therapist_name,
          u.login_id
        FROM app_users u
        JOIN patient_pii pii ON pii.patient_id = u.patient_id
        WHERE u.user_role = 'therapist'
          AND u.user_id = ANY($1::uuid[])
          ${canUseApprovalState ? "AND COALESCE(u.approval_state, 'approved') = 'approved'" : ""}
        ORDER BY pii.full_name ASC
      `,
      [fallbackUserIds],
    );

    for (const row of fallbackResult.rows as any[]) {
      byUserId.set(String(row.therapist_user_id), {
        therapistUserId: String(row.therapist_user_id),
        therapistName: String(row.therapist_name),
        loginId: row.login_id ? String(row.login_id) : null,
        organizationId: normalizedOrganizationId,
        profession: profileByUserId.get(String(row.therapist_user_id))?.profession ?? null,
      });
    }
  }

  return Array.from(byUserId.values()).sort((a, b) =>
    a.therapistName.localeCompare(b.therapistName, "ko"),
  );
}
