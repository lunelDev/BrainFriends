/**
 * src/lib/server/adverseEventsDb.ts
 *
 * 이상반응(AE) 리포지토리. 환자 본인 신고 + 처방자 검토 흐름.
 * IRB 신청 및 시판 후 안전관리 데이터 소스.
 */

import { randomUUID } from "crypto";
import { getDbPool } from "@/lib/server/postgres";

export type AdverseEventCategory =
  | "headache"        // 두통
  | "fatigue"         // 피로
  | "dizziness"       // 어지러움
  | "voice_fatigue"   // 음성 피로
  | "eye_fatigue"     // 눈 피로
  | "anxiety"         // 불안
  | "other";

export const AE_CATEGORIES: AdverseEventCategory[] = [
  "headache",
  "fatigue",
  "dizziness",
  "voice_fatigue",
  "eye_fatigue",
  "anxiety",
  "other",
];

export type AdverseEventReporterRole =
  | "patient"
  | "prescriber"
  | "therapist"
  | "admin";

export type AdverseEventRow = {
  id: string;
  patientUserId: string;
  patientPseudonymId: string;
  prescriptionId: string | null;
  reporterUserId: string;
  reporterRole: AdverseEventReporterRole;
  category: AdverseEventCategory;
  severity: 1 | 2 | 3;
  freeText: string | null;
  occurredAt: Date;
  resolvedAt: Date | null;
  prescriberAcknowledgedAt: Date | null;
  prescriberNote: string | null;
  createdAt: Date;
  updatedAt: Date;
};

async function ensureAdverseEventsTable() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS adverse_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_user_id UUID NOT NULL,
      patient_pseudonym_id VARCHAR(64) NOT NULL,
      prescription_id UUID,
      reporter_user_id UUID NOT NULL,
      reporter_role VARCHAR(20) NOT NULL,
      category VARCHAR(40) NOT NULL,
      severity SMALLINT NOT NULL CHECK (severity BETWEEN 1 AND 3),
      free_text TEXT,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ,
      prescriber_acknowledged_at TIMESTAMPTZ,
      prescriber_note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS adverse_events_patient_idx
      ON adverse_events (patient_user_id, occurred_at DESC)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS adverse_events_prescription_idx
      ON adverse_events (prescription_id)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS adverse_events_severity_idx
      ON adverse_events (severity, occurred_at DESC)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS adverse_events_unack_severe_idx
      ON adverse_events (severity, prescriber_acknowledged_at)
      WHERE severity = 3 AND prescriber_acknowledged_at IS NULL
  `);
}

function rowTo(row: Record<string, unknown>): AdverseEventRow {
  return {
    id: String(row.id),
    patientUserId: String(row.patient_user_id),
    patientPseudonymId: String(row.patient_pseudonym_id),
    prescriptionId: row.prescription_id ? String(row.prescription_id) : null,
    reporterUserId: String(row.reporter_user_id),
    reporterRole: String(row.reporter_role) as AdverseEventReporterRole,
    category: String(row.category) as AdverseEventCategory,
    severity: Number(row.severity) as 1 | 2 | 3,
    freeText: row.free_text ? String(row.free_text) : null,
    occurredAt: new Date(String(row.occurred_at)),
    resolvedAt: row.resolved_at ? new Date(String(row.resolved_at)) : null,
    prescriberAcknowledgedAt: row.prescriber_acknowledged_at
      ? new Date(String(row.prescriber_acknowledged_at))
      : null,
    prescriberNote: row.prescriber_note ? String(row.prescriber_note) : null,
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

export async function createAdverseEvent(input: {
  patientUserId: string;
  patientPseudonymId: string;
  prescriptionId?: string | null;
  reporterUserId: string;
  reporterRole: AdverseEventReporterRole;
  category: AdverseEventCategory;
  severity: 1 | 2 | 3;
  freeText?: string | null;
  occurredAt?: Date;
}): Promise<AdverseEventRow> {
  await ensureAdverseEventsTable();
  const pool = getDbPool();
  const r = await pool.query(
    `
      INSERT INTO adverse_events (
        id, patient_user_id, patient_pseudonym_id, prescription_id,
        reporter_user_id, reporter_role,
        category, severity, free_text,
        occurred_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *
    `,
    [
      randomUUID(),
      input.patientUserId,
      input.patientPseudonymId,
      input.prescriptionId ?? null,
      input.reporterUserId,
      input.reporterRole,
      input.category,
      input.severity,
      input.freeText ?? null,
      (input.occurredAt ?? new Date()).toISOString(),
    ],
  );
  return rowTo(r.rows[0]);
}

export async function listAdverseEventsForPatient(
  patientUserId: string,
  opts?: { limit?: number },
): Promise<AdverseEventRow[]> {
  await ensureAdverseEventsTable();
  const pool = getDbPool();
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 500);
  const r = await pool.query(
    `
      SELECT * FROM adverse_events
       WHERE patient_user_id = $1
       ORDER BY occurred_at DESC
       LIMIT $2
    `,
    [patientUserId, limit],
  );
  return r.rows.map(rowTo);
}

export async function listAdverseEventsForPrescriber(
  prescriberUserId: string,
  opts?: { limit?: number; onlyUnacknowledgedSevere?: boolean },
): Promise<AdverseEventRow[]> {
  await ensureAdverseEventsTable();
  const pool = getDbPool();
  const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 500);
  const filter = opts?.onlyUnacknowledgedSevere
    ? "AND ae.severity = 3 AND ae.prescriber_acknowledged_at IS NULL"
    : "";
  const r = await pool.query(
    `
      SELECT ae.*
        FROM adverse_events ae
        JOIN prescriptions p ON p.id = ae.prescription_id
       WHERE p.prescriber_user_id = $1
         ${filter}
       ORDER BY ae.occurred_at DESC
       LIMIT $2
    `,
    [prescriberUserId, limit],
  );
  return r.rows.map(rowTo);
}

export async function acknowledgeAdverseEvent(input: {
  id: string;
  prescriberUserId: string;
  note?: string | null;
}): Promise<AdverseEventRow | null> {
  await ensureAdverseEventsTable();
  const pool = getDbPool();
  const r = await pool.query(
    `
      UPDATE adverse_events ae
         SET prescriber_acknowledged_at = NOW(),
             prescriber_note = COALESCE($3, ae.prescriber_note),
             updated_at = NOW()
        FROM prescriptions p
       WHERE ae.id = $1
         AND ae.prescription_id = p.id
         AND p.prescriber_user_id = $2
       RETURNING ae.*
    `,
    [input.id, input.prescriberUserId, input.note ?? null],
  );
  return r.rows[0] ? rowTo(r.rows[0]) : null;
}

export async function resolveAdverseEvent(id: string): Promise<AdverseEventRow | null> {
  await ensureAdverseEventsTable();
  const pool = getDbPool();
  const r = await pool.query(
    `
      UPDATE adverse_events
         SET resolved_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *
    `,
    [id],
  );
  return r.rows[0] ? rowTo(r.rows[0]) : null;
}
