import { getAuthenticatedSessionContext } from "@/lib/server/accountAuth";
import {
  getAdminPatientReportDetail,
  listAdminPatientReportSummaries,
  listAdminReportValidationSample,
  type AdminPatientReportSummary,
} from "@/lib/server/adminReportsDb";
import { listAvailableOrganizations } from "@/lib/server/organizationCatalogDb";
import { getDbPool } from "@/lib/server/postgres";
import type { TrainingHistoryEntry } from "@/lib/kwab/SessionManager";

type SessionContext = NonNullable<
  Awaited<ReturnType<typeof getAuthenticatedSessionContext>>
>;

export type TherapistColleagueSummary = {
  therapistUserId: string;
  therapistName: string;
  loginId: string | null;
  organizationId: string | null;
  organizationName: string | null;
  approvalState: string | null;
  assignedPatientCount: number;
  lastLoginAt: string | null;
};

async function resolveScopedContext(sessionToken: string) {
  const context = await getAuthenticatedSessionContext(sessionToken);
  if (!context) {
    throw new Error("unauthorized");
  }

  return context;
}

async function hasAssignmentsTable() {
  const pool = getDbPool();
  const result = await pool.query<{ exists: boolean }>(
    `
      SELECT to_regclass('public.therapist_patient_assignments') IS NOT NULL AS exists
    `,
  );
  return Boolean(result.rows[0]?.exists);
}

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

async function getContextOrganizationId(context: SessionContext) {
  if (!(await hasOrganizationsColumn())) {
    return null;
  }

  const pool = getDbPool();
  const result = await pool.query<{ organization_id: string | null }>(
    `
      SELECT organization_id::text AS organization_id
      FROM app_users
      WHERE user_id = $1
      LIMIT 1
    `,
    [context.userId],
  );

  return result.rows[0]?.organization_id ? String(result.rows[0].organization_id) : null;
}

async function listAssignedPatientIds(context: SessionContext) {
  if (context.userRole === "admin") {
    return null;
  }
  if (context.userRole !== "therapist") {
    throw new Error("forbidden");
  }

  if (!(await hasAssignmentsTable())) {
    return [] as string[];
  }

  const pool = getDbPool();
  const result = await pool.query<{ patient_id: string }>(
    `
      SELECT DISTINCT patient_id::text AS patient_id
      FROM therapist_patient_assignments
      WHERE therapist_user_id = $1
        AND is_active = TRUE
      ORDER BY patient_id::text ASC
    `,
    [context.userId],
  );

  return result.rows
    .map((row) => String(row.patient_id ?? "").trim())
    .filter((value) => value.length > 0);
}

async function assertTherapistCanAccessPatient(
  context: SessionContext,
  patientId: string,
) {
  if (context.userRole === "admin") {
    return;
  }
  const assignedPatientIds = await listAssignedPatientIds(context);
  if (!assignedPatientIds?.includes(patientId)) {
    throw new Error("forbidden");
  }
}

export async function canTherapistAccessPatient(
  sessionToken: string,
  patientId: string,
) {
  const context = await resolveScopedContext(sessionToken);
  if (context.userRole === "admin") return true;
  const assignedPatientIds = await listAssignedPatientIds(context);
  return Boolean(assignedPatientIds?.includes(patientId));
}

export async function listTherapistPatientReportSummaries(sessionToken: string) {
  const context = await resolveScopedContext(sessionToken);
  if (context.userRole === "admin") {
    return listAdminPatientReportSummaries(sessionToken);
  }

  const assignedPatientIds = await listAssignedPatientIds(context);
  if (!assignedPatientIds?.length) {
    return [] satisfies AdminPatientReportSummary[];
  }

  const pool = getDbPool();
  const result = await pool.query(
    `
      SELECT
        pii.patient_id::text AS patient_id,
        ppm.patient_pseudonym_id,
        pii.full_name,
        pii.patient_code,
        pii.birth_date::text AS birth_date,
        au.login_id,
        (
          SELECT MAX(created_at)
          FROM (
            SELECT ltr.created_at
            FROM language_training_results ltr
            WHERE ltr.patient_pseudonym_id = ppm.patient_pseudonym_id
            UNION ALL
            SELECT sr.created_at
            FROM sing_results sr
            WHERE sr.patient_pseudonym_id = ppm.patient_pseudonym_id
          ) AS activities
        )::text AS latest_activity_at,
        (
          SELECT COUNT(*)::int
          FROM language_training_results ltr
          WHERE ltr.patient_pseudonym_id = ppm.patient_pseudonym_id
            AND ltr.training_mode = 'self'
        ) AS self_assessment_count,
        (
          SELECT COUNT(*)::int
          FROM language_training_results ltr
          WHERE ltr.patient_pseudonym_id = ppm.patient_pseudonym_id
            AND ltr.training_mode = 'rehab'
        ) AS rehab_count,
        (
          SELECT COUNT(*)::int
          FROM sing_results sr
          WHERE sr.patient_pseudonym_id = ppm.patient_pseudonym_id
        ) AS sing_count
      FROM patient_pii pii
      JOIN patient_pseudonym_map ppm ON ppm.patient_id = pii.patient_id
      JOIN app_users au ON au.patient_id = pii.patient_id
      WHERE pii.patient_id = ANY($1::uuid[])
      ORDER BY latest_activity_at DESC NULLS LAST, pii.created_at DESC
    `,
    [assignedPatientIds],
  );

  return result.rows.map((row: any) => ({
    patientId: String(row.patient_id),
    patientPseudonymId: String(row.patient_pseudonym_id),
    patientName: String(row.full_name),
    patientCode: String(row.patient_code),
    loginId: row.login_id ? String(row.login_id) : null,
    birthDate: row.birth_date ? String(row.birth_date) : null,
    latestActivityAt: row.latest_activity_at ? String(row.latest_activity_at) : null,
    selfAssessmentCount: Number(row.self_assessment_count ?? 0),
    rehabCount: Number(row.rehab_count ?? 0),
    singCount: Number(row.sing_count ?? 0),
  })) satisfies AdminPatientReportSummary[];
}

export async function listTherapistReportValidationSample(sessionToken: string) {
  const context = await resolveScopedContext(sessionToken);
  if (context.userRole === "admin") {
    return listAdminReportValidationSample(sessionToken);
  }

  const summaries = await listTherapistPatientReportSummaries(sessionToken);
  if (!summaries.length) {
    return [] satisfies TrainingHistoryEntry[];
  }

  const details = await Promise.all(
    summaries.map((summary) =>
      getAdminPatientReportDetail(sessionToken, summary.patientId),
    ),
  );

  return details
    .flatMap((detail) => detail.entries)
    .sort((left, right) => right.completedAt - left.completedAt);
}

export async function getTherapistPatientReportDetail(
  sessionToken: string,
  patientId: string,
) {
  const context = await resolveScopedContext(sessionToken);
  await assertTherapistCanAccessPatient(context, patientId);
  return getAdminPatientReportDetail(sessionToken, patientId);
}

export async function listTherapistColleagueSummaries(sessionToken: string) {
  const context = await resolveScopedContext(sessionToken);
  const pool = getDbPool();
  const canUseOrganization = await hasOrganizationsColumn();
  const canUseApprovalState = await hasApprovalStateColumn();
  const canUseAssignments = await hasAssignmentsTable();
  const availableOrganizations = await listAvailableOrganizations();
  const organizationNameMap = new Map(
    availableOrganizations.map((item) => [item.id, item.name] as const),
  );

  let whereClause = `WHERE u.user_role = 'therapist'`;
  const queryParams: Array<string> = [];

  if (context.userRole === "therapist") {
    if (!canUseOrganization) {
      return [] satisfies TherapistColleagueSummary[];
    }

    const organizationId = await getContextOrganizationId(context);
    if (!organizationId) {
      return [] satisfies TherapistColleagueSummary[];
    }

    queryParams.push(organizationId);
    whereClause += ` AND u.organization_id = $${queryParams.length}::uuid`;
  }

  const approvalSelect = canUseApprovalState
    ? `u.approval_state::text AS approval_state`
    : `NULL::text AS approval_state`;
  const organizationSelect = canUseOrganization
    ? `u.organization_id::text AS organization_id`
    : `NULL::text AS organization_id`;
  const assignmentJoin = canUseAssignments
    ? `
      LEFT JOIN therapist_patient_assignments tpa
        ON tpa.therapist_user_id = u.user_id
       AND tpa.is_active = TRUE
    `
    : "";
  const assignmentCount = canUseAssignments
    ? `COUNT(tpa.patient_id)::int AS assigned_patient_count`
    : `0::int AS assigned_patient_count`;

  const result = await pool.query(
    `
      SELECT
        u.user_id::text AS therapist_user_id,
        pii.full_name AS therapist_name,
        u.login_id,
        ${organizationSelect},
        ${approvalSelect},
        u.last_login_at::text AS last_login_at,
        ${assignmentCount}
      FROM app_users u
      JOIN patient_pii pii ON pii.patient_id = u.patient_id
      ${assignmentJoin}
      ${whereClause}
      GROUP BY
        u.user_id,
        pii.full_name,
        u.login_id,
        u.last_login_at
        ${canUseOrganization ? ", u.organization_id" : ""}
        ${canUseApprovalState ? ", u.approval_state" : ""}
      ORDER BY pii.full_name ASC
    `,
    queryParams,
  );

  return result.rows.map((row: any) => ({
    therapistUserId: String(row.therapist_user_id),
    therapistName: String(row.therapist_name),
    loginId: row.login_id ? String(row.login_id) : null,
    organizationId: row.organization_id ? String(row.organization_id) : null,
    organizationName: row.organization_id
      ? organizationNameMap.get(String(row.organization_id)) ?? null
      : null,
    approvalState: row.approval_state ? String(row.approval_state) : null,
    assignedPatientCount: Number(row.assigned_patient_count ?? 0),
    lastLoginAt: row.last_login_at ? String(row.last_login_at) : null,
  })) satisfies TherapistColleagueSummary[];
}
