import { createHash, randomBytes, randomUUID } from "crypto";
import { getDbPool } from "@/lib/server/postgres";
import {
  buildWeeklyReportSummary,
  maskGuardianPatientName,
  type WeeklyReportSummary,
  type WeeklyReportTrainingSession,
} from "@/lib/guardian/weeklyReportSummary";
import {
  normalizeGuardianReportTtlDays,
  resolveGuardianReportLinkStatus,
} from "@/lib/guardian/reportLinkPolicy";
import { safeAppendAccess } from "@/lib/server/auditLog";

export type GuardianReportLink = {
  id: string;
  token: string;
  urlPath: string;
  patientId: string;
  patientPseudonymId: string;
  recipientLabel: string | null;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
};

export type GuardianWeeklyReport = {
  linkId: string;
  patient: {
    maskedName: string;
    patientCode: string | null;
  };
  recipientLabel: string | null;
  generatedAt: string;
  expiresAt: string;
  summary: WeeklyReportSummary;
  recentSessions: WeeklyReportTrainingSession[];
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function ensureGuardianReportTables() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS guardian_report_links (
      id UUID PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      patient_id UUID NOT NULL,
      patient_pseudonym_id TEXT NOT NULL,
      created_by_user_id UUID NULL,
      recipient_label TEXT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      last_accessed_at TIMESTAMPTZ NULL,
      revoked_at TIMESTAMPTZ NULL,
      revoked_by_user_id UUID NULL,
      revoked_reason TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE guardian_report_links
      ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ NULL,
      ADD COLUMN IF NOT EXISTS revoked_by_user_id UUID NULL,
      ADD COLUMN IF NOT EXISTS revoked_reason TEXT NULL
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_guardian_report_links_patient
      ON guardian_report_links(patient_id, expires_at DESC)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_guardian_report_links_active
      ON guardian_report_links(token_hash)
      WHERE revoked_at IS NULL
  `);
}

export async function createGuardianReportLink(input: {
  patientId: string;
  createdByUserId?: string | null;
  recipientLabel?: string | null;
  ttlDays?: number;
}): Promise<GuardianReportLink> {
  await ensureGuardianReportTables();
  const pool = getDbPool();
  const patientResult = await pool.query(
    `
      SELECT
        pii.patient_id::text AS patient_id,
        ppm.patient_pseudonym_id
      FROM patient_pii pii
      JOIN patient_pseudonym_map ppm ON ppm.patient_id = pii.patient_id
      WHERE pii.patient_id::text = $1
      LIMIT 1
    `,
    [input.patientId],
  );
  const patient = patientResult.rows[0];
  if (!patient) throw new Error("patient_not_found");

  const token = randomBytes(32).toString("base64url");
  const id = randomUUID();
  const expiresAt = new Date(
    Date.now() + normalizeGuardianReportTtlDays(input.ttlDays) * 24 * 60 * 60 * 1000,
  );
  const recipientLabel = String(input.recipientLabel ?? "").trim() || null;

  const result = await pool.query(
    `
      INSERT INTO guardian_report_links (
        id, token_hash, patient_id, patient_pseudonym_id,
        created_by_user_id, recipient_label, expires_at, created_at
      )
      VALUES ($1, $2, $3::uuid, $4, $5::uuid, $6, $7, NOW())
      RETURNING id::text, patient_id::text, patient_pseudonym_id, recipient_label,
                expires_at::text, revoked_at::text, created_at::text
    `,
    [
      id,
      sha256(token),
      String(patient.patient_id),
      String(patient.patient_pseudonym_id),
      input.createdByUserId ?? null,
      recipientLabel,
      expiresAt.toISOString(),
    ],
  );
  const row = result.rows[0];
  return {
    id: String(row.id),
    token,
    urlPath: `/guardian/${encodeURIComponent(token)}`,
    patientId: String(row.patient_id),
    patientPseudonymId: String(row.patient_pseudonym_id),
    recipientLabel: row.recipient_label ? String(row.recipient_label) : null,
    expiresAt: new Date(row.expires_at).toISOString(),
    revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

async function tableExists(tableName: string) {
  const pool = getDbPool();
  const result = await pool.query(
    `SELECT to_regclass($1) IS NOT NULL AS exists`,
    [`public.${tableName}`],
  );
  return Boolean(result.rows[0]?.exists);
}

export async function getGuardianWeeklyReportByToken(
  token: string,
  audit?: { request: Request },
): Promise<GuardianWeeklyReport | null> {
  const normalizedToken = String(token ?? "").trim();
  if (!normalizedToken) return null;
  await ensureGuardianReportTables();

  const pool = getDbPool();
  const linkResult = await pool.query(
    `
      SELECT
        grl.id::text,
        grl.patient_id::text,
        grl.patient_pseudonym_id,
        grl.recipient_label,
        grl.expires_at::text,
        grl.revoked_at::text,
        pii.full_name,
        pii.patient_code
      FROM guardian_report_links grl
      JOIN patient_pii pii ON pii.patient_id = grl.patient_id
      WHERE grl.token_hash = $1
      LIMIT 1
    `,
    [sha256(normalizedToken)],
  );
  const link = linkResult.rows[0];
  if (!link) {
    if (audit?.request) {
      await safeAppendAccess({
        request: audit.request,
        action: "redeem",
        status: "rejected",
        operatorUserRole: "anonymous",
        resourceType: "guardian_report",
        httpStatus: 404,
        failureReason: "guardian_report_link_not_found",
      });
    }
    return null;
  }

  const status = resolveGuardianReportLinkStatus({
    expiresAt: String(link.expires_at),
    revokedAt: link.revoked_at ? String(link.revoked_at) : null,
  });
  if (status !== "active") {
    if (audit?.request) {
      await safeAppendAccess({
        request: audit.request,
        action: "redeem",
        status: "rejected",
        operatorUserRole: "anonymous",
        subjectUserId: String(link.patient_id),
        subjectPseudonymId: String(link.patient_pseudonym_id),
        resourceType: "guardian_report",
        resourceId: String(link.id),
        httpStatus: 404,
        failureReason: `guardian_report_link_${status}`,
      });
    }
    return null;
  }

  await pool.query(
    `UPDATE guardian_report_links SET last_accessed_at = NOW() WHERE id = $1::uuid`,
    [String(link.id)],
  );
  if (audit?.request) {
    await safeAppendAccess({
      request: audit.request,
      action: "redeem",
      status: "success",
      operatorUserRole: "anonymous",
      subjectUserId: String(link.patient_id),
      subjectPseudonymId: String(link.patient_pseudonym_id),
      resourceType: "guardian_report",
      resourceId: String(link.id),
      httpStatus: 200,
    });
  }

  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
  const patientPseudonymId = String(link.patient_pseudonym_id);

  const [languageRows, singRows] = await Promise.all([
    pool.query(
      `
        SELECT ltr.aq, ltr.step_scores, cs.completed_at
        FROM language_training_results ltr
        JOIN clinical_sessions cs ON cs.session_id = ltr.session_id
        WHERE ltr.patient_pseudonym_id = $1
          AND cs.completed_at >= $2
          AND cs.completed_at <= $3
        ORDER BY cs.completed_at ASC
      `,
      [patientPseudonymId, periodStart.toISOString(), periodEnd.toISOString()],
    ),
    pool.query(
      `
        SELECT sr.score, cs.completed_at
        FROM sing_results sr
        JOIN clinical_sessions cs ON cs.session_id = sr.session_id
        WHERE sr.patient_pseudonym_id = $1
          AND cs.completed_at >= $2
          AND cs.completed_at <= $3
        ORDER BY cs.completed_at ASC
      `,
      [patientPseudonymId, periodStart.toISOString(), periodEnd.toISOString()],
    ),
  ]);
  const adverseEventCount = (await tableExists("adverse_events"))
    ? Number(
        (
          await pool.query(
            `
              SELECT COUNT(*)::int AS count
              FROM adverse_events
              WHERE patient_pseudonym_id = $1
                AND occurred_at >= $2
                AND occurred_at <= $3
            `,
            [patientPseudonymId, periodStart.toISOString(), periodEnd.toISOString()],
          )
        ).rows[0]?.count ?? 0,
      )
    : 0;

  const sessions: WeeklyReportTrainingSession[] = [
    ...languageRows.rows.map((row: any) => ({
      kind: "language" as const,
      completedAt: new Date(row.completed_at).toISOString(),
      score: row.aq == null ? null : Number(row.aq),
      stepScores:
        row.step_scores && typeof row.step_scores === "object"
          ? (row.step_scores as Record<string, number>)
          : null,
    })),
    ...singRows.rows.map((row: any) => ({
      kind: "sing" as const,
      completedAt: new Date(row.completed_at).toISOString(),
      score: row.score == null ? null : Number(row.score),
      stepScores: null,
    })),
  ].sort((left, right) => left.completedAt.localeCompare(right.completedAt));

  return {
    linkId: String(link.id),
    patient: {
      maskedName: maskGuardianPatientName(String(link.full_name ?? "")),
      patientCode: link.patient_code ? String(link.patient_code) : null,
    },
    recipientLabel: link.recipient_label ? String(link.recipient_label) : null,
    generatedAt: new Date().toISOString(),
    expiresAt: new Date(link.expires_at).toISOString(),
    summary: buildWeeklyReportSummary({
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      sessions,
      adverseEventCount,
    }),
    recentSessions: sessions.slice(-10).reverse(),
  };
}

export async function revokeGuardianReportLink(input: {
  linkId: string;
  revokedByUserId: string;
  reason?: string | null;
}): Promise<{
  revoked: boolean;
  linkId: string;
  patientId: string | null;
  patientPseudonymId: string | null;
  alreadyRevoked: boolean;
}> {
  await ensureGuardianReportTables();
  const pool = getDbPool();
  const result = await pool.query(
    `
      UPDATE guardian_report_links
      SET
        revoked_at = COALESCE(revoked_at, NOW()),
        revoked_by_user_id = COALESCE(revoked_by_user_id, $2::uuid),
        revoked_reason = COALESCE(revoked_reason, $3)
      WHERE id = $1::uuid
      RETURNING
        id::text,
        patient_id::text,
        patient_pseudonym_id,
        revoked_at::text,
        (revoked_by_user_id IS DISTINCT FROM $2::uuid) AS already_revoked
    `,
    [input.linkId, input.revokedByUserId, String(input.reason ?? "manual_revoke")],
  );
  const row = result.rows[0];
  if (!row) {
    return {
      revoked: false,
      linkId: input.linkId,
      patientId: null,
      patientPseudonymId: null,
      alreadyRevoked: false,
    };
  }
  return {
    revoked: true,
    linkId: String(row.id),
    patientId: String(row.patient_id),
    patientPseudonymId: String(row.patient_pseudonym_id),
    alreadyRevoked: Boolean(row.already_revoked),
  };
}

export async function getGuardianReportLinkAccessMetadata(linkId: string): Promise<{
  linkId: string;
  patientId: string;
  patientPseudonymId: string;
} | null> {
  await ensureGuardianReportTables();
  const pool = getDbPool();
  const result = await pool.query(
    `
      SELECT id::text, patient_id::text, patient_pseudonym_id
      FROM guardian_report_links
      WHERE id = $1::uuid
      LIMIT 1
    `,
    [linkId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    linkId: String(row.id),
    patientId: String(row.patient_id),
    patientPseudonymId: String(row.patient_pseudonym_id),
  };
}

export async function listGuardianWeeklyReportCandidates(input: {
  createdByUserId: string;
  userRole: "admin" | "therapist";
  patientIds?: string[];
}) {
  await ensureGuardianReportTables();
  const pool = getDbPool();
  if (input.userRole === "therapist" && !(await tableExists("therapist_patient_assignments"))) {
    return [] as Array<{
      patientId: string;
      maskedName: string;
      latestCompletedAt: string | null;
    }>;
  }
  const params: unknown[] = [];
  let therapistUserParam = "";
  if (input.userRole === "therapist") {
    params.push(input.createdByUserId);
    therapistUserParam = `$${params.length}::uuid`;
  }
  let patientFilter = "";
  if (input.patientIds?.length) {
    params.push(input.patientIds);
    patientFilter = `AND pii.patient_id::text = ANY($${params.length}::text[])`;
  }
  const assignmentFilter =
    input.userRole === "therapist"
      ? `
        AND EXISTS (
          SELECT 1
          FROM therapist_patient_assignments tpa
          WHERE tpa.patient_id = pii.patient_id
            AND tpa.therapist_user_id = ${therapistUserParam}
            AND COALESCE(tpa.is_active, TRUE) = TRUE
        )
      `
      : "";

  const result = await pool.query(
    `
      SELECT
        pii.patient_id::text AS patient_id,
        pii.full_name,
        MAX(activity.completed_at)::text AS latest_completed_at
      FROM patient_pii pii
      JOIN patient_pseudonym_map ppm ON ppm.patient_id = pii.patient_id
      LEFT JOIN LATERAL (
        SELECT cs.completed_at
        FROM language_training_results ltr
        JOIN clinical_sessions cs ON cs.session_id = ltr.session_id
        WHERE ltr.patient_pseudonym_id = ppm.patient_pseudonym_id
        UNION ALL
        SELECT cs.completed_at
        FROM sing_results sr
        JOIN clinical_sessions cs ON cs.session_id = sr.session_id
        WHERE sr.patient_pseudonym_id = ppm.patient_pseudonym_id
      ) activity ON TRUE
      WHERE TRUE
        ${assignmentFilter}
        ${patientFilter}
      GROUP BY pii.patient_id, pii.full_name
      HAVING MAX(activity.completed_at) >= NOW() - INTERVAL '7 days'
      ORDER BY latest_completed_at DESC NULLS LAST
      LIMIT 200
    `,
    params,
  );

  return result.rows.map((row: any) => ({
    patientId: String(row.patient_id),
    maskedName: maskGuardianPatientName(String(row.full_name ?? "")),
    latestCompletedAt: row.latest_completed_at
      ? new Date(row.latest_completed_at).toISOString()
      : null,
  }));
}
