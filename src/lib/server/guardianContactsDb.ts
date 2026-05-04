import { createHash, randomUUID } from "crypto";
import { evaluateGuardianConsent, type GuardianConsentState } from "@/lib/guardian/consentState";
import { getDbPool } from "@/lib/server/postgres";

export type GuardianContactType = "email" | "phone";

export interface GuardianContactRecord {
  id: string;
  patientId: string;
  patientPseudonymId: string;
  guardianNameMasked: string;
  relationship: string;
  contactType: GuardianContactType;
  contactMasked: string;
  consentState: GuardianConsentState;
  effectiveConsentState: GuardianConsentState;
  reportAccessAllowed: boolean;
  requestedAt: string;
  decidedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function normalizeGuardianContactValue(
  contactType: GuardianContactType,
  value: string,
) {
  const trimmed = String(value ?? "").trim();
  if (contactType === "email") return trimmed.toLowerCase();
  return trimmed.replace(/[^\d+]/g, "");
}

export function maskGuardianName(value: string) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.length <= 2) return `${trimmed[0]}*`;
  return `${trimmed[0]}${"*".repeat(Math.max(1, trimmed.length - 2))}${trimmed.at(-1)}`;
}

export function maskGuardianContact(contactType: GuardianContactType, value: string) {
  const normalized = normalizeGuardianContactValue(contactType, value);
  if (!normalized) return "";
  if (contactType === "email") {
    const [local, domain] = normalized.split("@");
    if (!local || !domain) return "***";
    const visible = local.length <= 2 ? local[0] ?? "*" : local.slice(0, 2);
    return `${visible}${"*".repeat(Math.max(2, local.length - visible.length))}@${domain}`;
  }
  const digits = normalized.replace(/\D/g, "");
  if (digits.length <= 4) return "****";
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

export function hashGuardianContact(contactType: GuardianContactType, value: string) {
  const normalized = normalizeGuardianContactValue(contactType, value);
  return createHash("sha256").update(`${contactType}:${normalized}`).digest("hex");
}

async function ensureGuardianContactTables() {
  const pool = getDbPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS guardian_contacts (
      id UUID PRIMARY KEY,
      patient_id UUID NOT NULL,
      patient_pseudonym_id TEXT NOT NULL,
      guardian_name_masked TEXT NOT NULL,
      relationship TEXT NOT NULL,
      contact_type TEXT NOT NULL,
      contact_hash TEXT NOT NULL,
      contact_masked TEXT NOT NULL,
      consent_state TEXT NOT NULL,
      requested_at TIMESTAMPTZ NOT NULL,
      decided_at TIMESTAMPTZ NULL,
      revoked_at TIMESTAMPTZ NULL,
      created_by_user_id UUID NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_guardian_contacts_patient
      ON guardian_contacts(patient_id, updated_at DESC)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_guardian_contacts_granted
      ON guardian_contacts(patient_id, consent_state)
  `);
}

async function getPatientPseudonym(patientId: string) {
  const pool = getDbPool();
  const result = await pool.query(
    `
      SELECT
        pii.patient_id::text AS patient_id,
        ppm.patient_pseudonym_id
      FROM patient_pii pii
      JOIN patient_pseudonym_map ppm ON ppm.patient_id = pii.patient_id
      WHERE pii.patient_id::text = $1
      LIMIT 1
    `,
    [patientId],
  );
  const row = result.rows[0];
  if (!row) throw new Error("patient_not_found");
  return {
    patientId: String(row.patient_id),
    patientPseudonymId: String(row.patient_pseudonym_id),
  };
}

function mapGuardianContactRow(row: any): GuardianContactRecord {
  const requestedAt = new Date(row.requested_at).toISOString();
  const decidedAt = row.decided_at ? new Date(row.decided_at).toISOString() : null;
  const consentState = String(row.consent_state) as GuardianConsentState;
  const outcome = evaluateGuardianConsent({
    consentId: String(row.id),
    state: consentState,
    requestedAtMs: new Date(requestedAt).getTime(),
    decidedAtMs: decidedAt ? new Date(decidedAt).getTime() : null,
    nowMs: Date.now(),
  });

  return {
    id: String(row.id),
    patientId: String(row.patient_id),
    patientPseudonymId: String(row.patient_pseudonym_id),
    guardianNameMasked: String(row.guardian_name_masked ?? ""),
    relationship: String(row.relationship ?? ""),
    contactType: String(row.contact_type) === "phone" ? "phone" : "email",
    contactMasked: String(row.contact_masked ?? ""),
    consentState,
    effectiveConsentState: outcome.effectiveState,
    reportAccessAllowed: outcome.reportAccessAllowed,
    requestedAt,
    decidedAt,
    revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function listGuardianContacts(patientId: string) {
  await ensureGuardianContactTables();
  const pool = getDbPool();
  const result = await pool.query(
    `
      SELECT
        id::text, patient_id::text, patient_pseudonym_id, guardian_name_masked,
        relationship, contact_type, contact_masked, consent_state,
        requested_at::text, decided_at::text, revoked_at::text,
        created_at::text, updated_at::text
      FROM guardian_contacts
      WHERE patient_id::text = $1
      ORDER BY updated_at DESC
      LIMIT 20
    `,
    [patientId],
  );
  return result.rows.map(mapGuardianContactRow);
}

export async function upsertGuardianContact(input: {
  patientId: string;
  guardianName: string;
  relationship: string;
  contactType: GuardianContactType;
  contactValue: string;
  consentGranted: boolean;
  createdByUserId?: string | null;
}) {
  await ensureGuardianContactTables();
  const pool = getDbPool();
  const patient = await getPatientPseudonym(input.patientId);
  const normalized = normalizeGuardianContactValue(input.contactType, input.contactValue);
  if (!normalized) throw new Error("missing_guardian_contact");
  const contactHash = hashGuardianContact(input.contactType, normalized);
  const id = randomUUID();
  const consentState: GuardianConsentState = input.consentGranted ? "granted" : "pending";
  const now = new Date().toISOString();
  const result = await pool.query(
    `
      INSERT INTO guardian_contacts (
        id, patient_id, patient_pseudonym_id, guardian_name_masked,
        relationship, contact_type, contact_hash, contact_masked,
        consent_state, requested_at, decided_at, created_by_user_id,
        created_at, updated_at
      )
      VALUES (
        $1::uuid, $2::uuid, $3, $4,
        $5, $6, $7, $8,
        $9, $10::timestamptz, $11::timestamptz, $12::uuid,
        NOW(), NOW()
      )
      RETURNING
        id::text, patient_id::text, patient_pseudonym_id, guardian_name_masked,
        relationship, contact_type, contact_masked, consent_state,
        requested_at::text, decided_at::text, revoked_at::text,
        created_at::text, updated_at::text
    `,
    [
      id,
      patient.patientId,
      patient.patientPseudonymId,
      maskGuardianName(input.guardianName),
      String(input.relationship ?? "").trim() || "보호자",
      input.contactType,
      contactHash,
      maskGuardianContact(input.contactType, normalized),
      consentState,
      now,
      input.consentGranted ? now : null,
      input.createdByUserId ?? null,
    ],
  );
  return mapGuardianContactRow(result.rows[0]);
}

export async function revokeGuardianContactConsent(input: {
  contactId: string;
  patientId: string;
}) {
  await ensureGuardianContactTables();
  const pool = getDbPool();
  const result = await pool.query(
    `
      UPDATE guardian_contacts
      SET consent_state = 'revoked', revoked_at = NOW(), updated_at = NOW()
      WHERE id = $1::uuid AND patient_id::text = $2
      RETURNING
        id::text, patient_id::text, patient_pseudonym_id, guardian_name_masked,
        relationship, contact_type, contact_masked, consent_state,
        requested_at::text, decided_at::text, revoked_at::text,
        created_at::text, updated_at::text
    `,
    [input.contactId, input.patientId],
  );
  const row = result.rows[0];
  if (!row) throw new Error("guardian_contact_not_found");
  return mapGuardianContactRow(row);
}

export async function getGrantedGuardianContactForPatient(patientId: string) {
  await ensureGuardianContactTables();
  const pool = getDbPool();
  const result = await pool.query(
    `
      SELECT
        id::text, patient_id::text, patient_pseudonym_id, guardian_name_masked,
        relationship, contact_type, contact_masked, consent_state,
        requested_at::text, decided_at::text, revoked_at::text,
        created_at::text, updated_at::text
      FROM guardian_contacts
      WHERE patient_id::text = $1
        AND consent_state = 'granted'
        AND revoked_at IS NULL
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    [patientId],
  );
  const row = result.rows[0];
  return row ? mapGuardianContactRow(row) : null;
}
