/**
 * 신규 `clinical_patient_profiles` 테이블 전용 리포지토리.
 *
 * 설계 원칙 (PHI 분리)
 *   - PK 는 `patient_pseudonym_id` (VARCHAR) — user.id 를 직접 참조하지 않는다.
 *   - patient_pseudonym_map 을 통해서만 사용자와 연결된다.
 *   - 재활 배경 데이터(발병일, 편마비, 우/좌세 등)는 임상 계층에만 둔다.
 *
 * 레거시 대응
 *   - 기존 patient_intake_profiles 와 동일한 축의 데이터를 갖지만,
 *     신규 라우트가 사용하는 키는 patient_pseudonym_id 로 통일.
 */
import type { PoolClient } from "pg";
import { getDbPool } from "@/lib/server/postgres";

export type Hemiplegia = "N" | "L" | "R" | "B";
export type Hand = "L" | "R" | "U";
export type Hemianopsia = "NONE" | "LEFT" | "RIGHT" | "BOTH";

export type ClinicalPatientProfileRow = {
  patientPseudonymId: string;
  educationYears: number;
  onsetDate: string | null;
  daysSinceOnset: number | null;
  hemiplegia: Hemiplegia;
  hemianopsia: Hemianopsia;
  hand: Hand;
  createdAt: Date;
  updatedAt: Date;
};

export type UpsertClinicalPatientProfileInput = {
  patientPseudonymId: string;
  educationYears?: number;
  onsetDate?: string | null;
  daysSinceOnset?: number | null;
  hemiplegia?: Hemiplegia;
  hemianopsia?: Hemianopsia;
  hand?: Hand;
};

function normalizeHemiplegia(value: unknown): Hemiplegia {
  if (value === "L" || value === "R" || value === "B") return value;
  return "N";
}

function normalizeHand(value: unknown): Hand {
  if (value === "L" || value === "R") return value;
  return "U";
}

function normalizeHemianopsia(value: unknown): Hemianopsia {
  if (value === "LEFT" || value === "RIGHT" || value === "BOTH") return value;
  return "NONE";
}

function rowToProfile(row: Record<string, unknown>): ClinicalPatientProfileRow {
  const onsetRaw = row.onset_date;
  return {
    patientPseudonymId: String(row.patient_pseudonym_id),
    educationYears: Number(row.education_years ?? 0),
    onsetDate: onsetRaw
      ? onsetRaw instanceof Date
        ? onsetRaw.toISOString().slice(0, 10)
        : String(onsetRaw).slice(0, 10)
      : null,
    daysSinceOnset:
      row.days_since_onset === null || row.days_since_onset === undefined
        ? null
        : Number(row.days_since_onset),
    hemiplegia: normalizeHemiplegia(row.hemiplegia),
    hemianopsia: normalizeHemianopsia(row.hemianopsia),
    hand: normalizeHand(row.hand),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

export async function upsertClinicalPatientProfile(
  client: PoolClient,
  input: UpsertClinicalPatientProfileInput,
): Promise<ClinicalPatientProfileRow> {
  const result = await client.query(
    `
      INSERT INTO clinical_patient_profiles (
        patient_pseudonym_id, education_years, onset_date, days_since_onset,
        hemiplegia, hemianopsia, hand,
        created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7, NOW(), NOW())
      ON CONFLICT (patient_pseudonym_id) DO UPDATE
      SET
        education_years = EXCLUDED.education_years,
        onset_date = EXCLUDED.onset_date,
        days_since_onset = EXCLUDED.days_since_onset,
        hemiplegia = EXCLUDED.hemiplegia,
        hemianopsia = EXCLUDED.hemianopsia,
        hand = EXCLUDED.hand,
        updated_at = NOW()
      RETURNING *
    `,
    [
      input.patientPseudonymId,
      input.educationYears ?? 0,
      input.onsetDate ?? null,
      input.daysSinceOnset ?? null,
      normalizeHemiplegia(input.hemiplegia),
      normalizeHemianopsia(input.hemianopsia),
      normalizeHand(input.hand),
    ],
  );
  return rowToProfile(result.rows[0]);
}

export async function getClinicalPatientProfile(
  client: PoolClient,
  patientPseudonymId: string,
): Promise<ClinicalPatientProfileRow | null> {
  const result = await client.query(
    `SELECT * FROM clinical_patient_profiles WHERE patient_pseudonym_id = $1`,
    [patientPseudonymId],
  );
  return result.rows[0] ? rowToProfile(result.rows[0]) : null;
}

/** 편의 래퍼 */
export async function upsertClinicalPatientProfileStandalone(
  input: UpsertClinicalPatientProfileInput,
): Promise<ClinicalPatientProfileRow> {
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const row = await upsertClinicalPatientProfile(client, input);
    await client.query("COMMIT");
    return row;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
