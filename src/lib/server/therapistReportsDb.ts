import { getAuthenticatedSessionContext } from "@/lib/server/accountAuth";
import {
  getAdminPatientReportDetail,
  listAdminPatientReportSummaries,
  listAdminReportValidationSample,
  type AdminPatientReportSummary,
} from "@/lib/server/adminReportsDb";
import { listAvailableOrganizations } from "@/lib/server/organizationCatalogDb";
import { getDbPool } from "@/lib/server/postgres";
import { getTherapistRegistrationProfilesByUserIds } from "@/lib/server/therapistRegistrationProfiles";
import {
  listAllTherapistPatientNotes,
  type TherapistPatientNote,
} from "@/lib/server/therapistNotes";
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
  requestedOrganizationName: string | null;
  approvalState: string | null;
  assignedPatientCount: number;
  lastLoginAt: string | null;
  phone: string | null;
  email: string | null;
  profession: string | null;
  licenseNumber: string | null;
  licenseFileName: string | null;
  licenseIssuedBy: string | null;
  licenseIssuedDate: string | null;
  employmentStatus: string | null;
  department: string | null;
  twoFactorMethod: string | null;
  accessRole: string | null;
  canViewPatients: boolean;
  canEditPatientData: boolean;
  canEnterEvaluation: boolean;
  experienceYears: number | null;
  specialties: string | null;
  servicePurpose: string | null;
  targetPatientTypes: string | null;
  dataConsentScope: string | null;
  irbParticipation: string | null;
  privacyAgreed: boolean;
  patientDataAccessAgreed: boolean;
  securityPolicyAgreed: boolean;
  confidentialityAgreed: boolean;
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
  const client = await pool.connect();
  try {
    // adminReportsDb.listAdminPatientReportSummaries 와 동일한 defensive 패턴.
    // 런타임 DB 에 따라 일부 테이블이 아직 없을 수 있으므로 조건부 SELECT/JOIN 을 구성한다.
    const probe = await client.query(
      `
        SELECT
          to_regclass('public.therapist_patient_assignments') IS NOT NULL AS has_assignments,
          to_regclass('public.patient_intake_profiles')       IS NOT NULL AS has_intake,
          to_regclass('public.organizations')                 IS NOT NULL AS has_organizations
      `,
    );
    const hasAssignmentsTable = Boolean(probe.rows[0]?.has_assignments);
    const hasIntakeTable = Boolean(probe.rows[0]?.has_intake);
    const hasOrganizationsTable = Boolean(probe.rows[0]?.has_organizations);

    const therapistSelect = hasAssignmentsTable
      ? `
          tpii.full_name AS therapist_name,
          tu.login_id    AS therapist_login_id,
          tu.user_id::text AS therapist_user_id,
          ${hasOrganizationsTable ? "torg.organization_name" : "NULL::text"} AS therapist_organization_name,
      `
      : `
          NULL::text AS therapist_name,
          NULL::text AS therapist_login_id,
          NULL::text AS therapist_user_id,
          NULL::text AS therapist_organization_name,
      `;

    const therapistJoin = hasAssignmentsTable
      ? `
          LEFT JOIN LATERAL (
            SELECT tpa.therapist_user_id
            FROM therapist_patient_assignments tpa
            WHERE tpa.patient_id = pii.patient_id
              AND COALESCE(tpa.is_active, TRUE) = TRUE
            ORDER BY tpa.assigned_at DESC NULLS LAST
            LIMIT 1
          ) tpa ON TRUE
          LEFT JOIN app_users  tu   ON tu.user_id    = tpa.therapist_user_id
          LEFT JOIN patient_pii tpii ON tpii.patient_id = tu.patient_id
          ${
            hasOrganizationsTable
              ? "LEFT JOIN organizations torg ON torg.organization_id = tu.organization_id"
              : ""
          }
      `
      : "";

    const intakeSelect = hasIntakeTable
      ? `
          pip.education_years   AS education_years,
          pip.onset_date::text  AS onset_date,
          pip.days_since_onset  AS days_since_onset,
          pip.hemiplegia        AS hemiplegia,
          pip.hemianopsia       AS hemianopsia,
          pip.hand              AS hand,
      `
      : `
          NULL::int  AS education_years,
          NULL::text AS onset_date,
          NULL::int  AS days_since_onset,
          NULL::text AS hemiplegia,
          NULL::text AS hemianopsia,
          NULL::text AS hand,
      `;

    const intakeJoin = hasIntakeTable
      ? `LEFT JOIN patient_intake_profiles pip ON pip.patient_id = pii.patient_id`
      : "";

    const result = await client.query(
      `
        SELECT
          pii.patient_id::text AS patient_id,
          ppm.patient_pseudonym_id,
          pii.full_name,
          pii.patient_code,
          pii.birth_date::text AS birth_date,
          pii.phone,
          pii.sex,
          pii.created_at::text AS created_at,
          au.login_id,
          ${intakeSelect}
          ${therapistSelect}
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
        JOIN app_users au
          ON au.patient_id = pii.patient_id
         AND au.user_role = 'patient'
        ${intakeJoin}
        ${therapistJoin}
        WHERE pii.patient_id = ANY($1::uuid[])
        ORDER BY latest_activity_at DESC NULLS LAST, pii.created_at DESC
      `,
      [assignedPatientIds],
    );

    return result.rows.map((row: any) => {
      const sexRaw =
        typeof row.sex === "string" ? row.sex.trim().toUpperCase() : "";
      const sex: "M" | "F" | "U" | null =
        sexRaw === "M" || sexRaw === "F" || sexRaw === "U"
          ? (sexRaw as "M" | "F" | "U")
          : null;
      const hemiplegiaRaw =
        typeof row.hemiplegia === "string"
          ? row.hemiplegia.trim().toUpperCase()
          : "";
      const hemiplegia: "Y" | "N" | null =
        hemiplegiaRaw === "Y" || hemiplegiaRaw === "N"
          ? (hemiplegiaRaw as "Y" | "N")
          : null;
      const hemianopsiaRaw =
        typeof row.hemianopsia === "string"
          ? row.hemianopsia.trim().toUpperCase()
          : "";
      const hemianopsia: "LEFT" | "RIGHT" | "NONE" | null =
        hemianopsiaRaw === "LEFT" ||
        hemianopsiaRaw === "RIGHT" ||
        hemianopsiaRaw === "NONE"
          ? (hemianopsiaRaw as "LEFT" | "RIGHT" | "NONE")
          : null;

      return {
        patientId: String(row.patient_id),
        patientPseudonymId: String(row.patient_pseudonym_id),
        patientName: String(row.full_name),
        patientCode: String(row.patient_code),
        loginId: row.login_id ? String(row.login_id) : null,
        birthDate: row.birth_date ? String(row.birth_date) : null,
        phone: row.phone ? String(row.phone) : null,
        sex,
        educationYears:
          row.education_years == null ? null : Number(row.education_years),
        onsetDate: row.onset_date ? String(row.onset_date) : null,
        daysSinceOnset:
          row.days_since_onset == null ? null : Number(row.days_since_onset),
        hemiplegia,
        hemianopsia,
        hand: row.hand ? String(row.hand) : null,
        latestActivityAt: row.latest_activity_at
          ? String(row.latest_activity_at)
          : null,
        createdAt: row.created_at ? String(row.created_at) : null,
        selfAssessmentCount: Number(row.self_assessment_count ?? 0),
        rehabCount: Number(row.rehab_count ?? 0),
        singCount: Number(row.sing_count ?? 0),
        therapistName: row.therapist_name ? String(row.therapist_name) : null,
        therapistLoginId: row.therapist_login_id
          ? String(row.therapist_login_id)
          : null,
        therapistUserId: row.therapist_user_id
          ? String(row.therapist_user_id)
          : null,
        therapistOrganizationName: row.therapist_organization_name
          ? String(row.therapist_organization_name)
          : null,
      };
    }) satisfies AdminPatientReportSummary[];
  } finally {
    client.release();
  }
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

/**
 * 현재 세션이 접근 가능한 환자의 메모/follow-up 만 골라서 반환한다.
 * - admin: 전체 메모
 * - therapist: 본인 담당 환자에 대한 메모만
 *
 * 반환은 patientId → TherapistPatientNote 형태의 record.
 * 화면 단에서 환자 행과 join 해서 follow-up 뱃지/메모 미리보기를 그릴 때 사용한다.
 */
export async function listTherapistPatientNotesScoped(sessionToken: string) {
  const context = await resolveScopedContext(sessionToken);
  const allNotes = await listAllTherapistPatientNotes();

  if (context.userRole === "admin") {
    return allNotes;
  }

  const assignedPatientIds = await listAssignedPatientIds(context);
  if (!assignedPatientIds?.length) {
    return {} as Record<string, TherapistPatientNote>;
  }

  const allowed = new Set(assignedPatientIds);
  const scoped: Record<string, TherapistPatientNote> = {};
  for (const [patientId, note] of Object.entries(allNotes)) {
    if (allowed.has(patientId)) {
      scoped[patientId] = note;
    }
  }
  return scoped;
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

  const profiles = await getTherapistRegistrationProfilesByUserIds(
    result.rows.map((row: any) => String(row.therapist_user_id)),
  );
  const profileMap = new Map(profiles.map((item) => [item.userId, item] as const));

  return result.rows.map((row: any) => ({
    therapistUserId: String(row.therapist_user_id),
    therapistName: String(row.therapist_name),
    loginId: row.login_id ? String(row.login_id) : null,
    organizationId: row.organization_id ? String(row.organization_id) : null,
    organizationName: row.organization_id
      ? organizationNameMap.get(String(row.organization_id)) ?? null
      : null,
    requestedOrganizationName:
      profileMap.get(String(row.therapist_user_id))?.requestedOrganizationName ?? null,
    approvalState: row.approval_state ? String(row.approval_state) : null,
    assignedPatientCount: Number(row.assigned_patient_count ?? 0),
    lastLoginAt: row.last_login_at ? String(row.last_login_at) : null,
    phone: profileMap.get(String(row.therapist_user_id))?.phone ?? null,
    email: profileMap.get(String(row.therapist_user_id))?.email ?? null,
    profession: profileMap.get(String(row.therapist_user_id))?.profession ?? null,
    licenseNumber:
      profileMap.get(String(row.therapist_user_id))?.licenseNumber ?? null,
    licenseFileName:
      profileMap.get(String(row.therapist_user_id))?.licenseFileName ?? null,
    licenseIssuedBy:
      profileMap.get(String(row.therapist_user_id))?.licenseIssuedBy ?? null,
    licenseIssuedDate:
      profileMap.get(String(row.therapist_user_id))?.licenseIssuedDate ?? null,
    employmentStatus:
      profileMap.get(String(row.therapist_user_id))?.employmentStatus ?? null,
    department: profileMap.get(String(row.therapist_user_id))?.department ?? null,
    twoFactorMethod:
      profileMap.get(String(row.therapist_user_id))?.twoFactorMethod ?? null,
    accessRole: profileMap.get(String(row.therapist_user_id))?.accessRole ?? null,
    canViewPatients:
      profileMap.get(String(row.therapist_user_id))?.canViewPatients ?? false,
    canEditPatientData:
      profileMap.get(String(row.therapist_user_id))?.canEditPatientData ?? false,
    canEnterEvaluation:
      profileMap.get(String(row.therapist_user_id))?.canEnterEvaluation ?? false,
    experienceYears:
      profileMap.get(String(row.therapist_user_id))?.experienceYears ?? null,
    specialties: profileMap.get(String(row.therapist_user_id))?.specialties ?? null,
    servicePurpose:
      profileMap.get(String(row.therapist_user_id))?.servicePurpose ?? null,
    targetPatientTypes:
      profileMap.get(String(row.therapist_user_id))?.targetPatientTypes ?? null,
    dataConsentScope:
      profileMap.get(String(row.therapist_user_id))?.dataConsentScope ?? null,
    irbParticipation:
      profileMap.get(String(row.therapist_user_id))?.irbParticipation ?? null,
    privacyAgreed:
      profileMap.get(String(row.therapist_user_id))?.privacyAgreed ?? false,
    patientDataAccessAgreed:
      profileMap.get(String(row.therapist_user_id))?.patientDataAccessAgreed ?? false,
    securityPolicyAgreed:
      profileMap.get(String(row.therapist_user_id))?.securityPolicyAgreed ?? false,
    confidentialityAgreed:
      profileMap.get(String(row.therapist_user_id))?.confidentialityAgreed ?? false,
  })) satisfies TherapistColleagueSummary[];
}
