import { createHash } from "crypto";
import type { PoolClient } from "pg";
import type { PatientProfile } from "@/lib/patientStorage";
import { getDbPool } from "@/lib/server/postgres";

export function hashValue(seed: string): string {
  return createHash("sha256").update(seed).digest("hex");
}

export function deterministicUuid(seed: string): string {
  const hex = hashValue(seed).slice(0, 32);
  const chars = hex.split("");
  chars[12] = "5";
  chars[16] = ((parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  const normalized = chars.join("");
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20, 32)}`;
}

export function buildPatientIdentity(patient: PatientProfile): string {
  return [
    patient.name.trim(),
    patient.birthDate ?? "",
    patient.gender,
    patient.phone ?? "",
    patient.language ?? "ko",
  ].join("|");
}

export function buildPatientCode(patientId: string): string {
  return `PT-${patientId.slice(0, 8).toUpperCase()}`;
}

export function buildPatientPseudonymId(patient: PatientProfile): string {
  const seed = buildPatientIdentity(patient);
  return `psn_${hashValue(seed).slice(0, 24)}`;
}

export async function upsertPatientIdentity(
  client: PoolClient,
  patient: PatientProfile,
) {
  const patientIdentity = buildPatientIdentity(patient);
  const patientId = deterministicUuid(`patient:${patientIdentity}`);
  const patientCode = buildPatientCode(patientId);
  const patientPseudonymId = buildPatientPseudonymId(patient);

  await client.query(
    `
      INSERT INTO patient_pii (
        patient_id,
        patient_code,
        full_name,
        birth_date,
        sex,
        phone,
        language,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT (patient_id) DO UPDATE
      SET
        patient_code = EXCLUDED.patient_code,
        full_name = EXCLUDED.full_name,
        birth_date = EXCLUDED.birth_date,
        sex = EXCLUDED.sex,
        phone = EXCLUDED.phone,
        language = EXCLUDED.language,
        updated_at = NOW()
    `,
    [
      patientId,
      patientCode,
      patient.name.trim(),
      patient.birthDate || null,
      patient.gender || "U",
      patient.phone || null,
      patient.language || "ko",
    ],
  );

  await client.query(
    `
      INSERT INTO patient_pseudonym_map (
        patient_pseudonym_id,
        patient_id,
        mapping_version,
        created_at
      )
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (patient_pseudonym_id) DO UPDATE
      SET
        patient_id = EXCLUDED.patient_id,
        mapping_version = EXCLUDED.mapping_version
    `,
    [patientPseudonymId, patientId, "pseudonym-map-v1"],
  );

  return {
    patientId,
    patientCode,
    patientPseudonymId,
  };
}

export async function ensurePatientIdentity(patient: PatientProfile) {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const identity = await upsertPatientIdentity(client, patient);
    await client.query("COMMIT");
    return identity;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

