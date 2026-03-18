import { getAuthenticatedSessionContext } from "@/lib/server/accountAuth";
import { getDbPool } from "@/lib/server/postgres";
import type {
  SingHistoryResult,
  TrainingMode,
  TrainingHistoryEntry,
} from "@/lib/kwab/SessionManager";

export type AdminPatientReportSummary = {
  patientId: string;
  patientPseudonymId: string;
  patientName: string;
  patientCode: string;
  loginId: string | null;
  birthDate: string | null;
  latestActivityAt: string | null;
  selfAssessmentCount: number;
  rehabCount: number;
  singCount: number;
};

type AdminReportPatientRow = {
  patient_id: string;
  patient_pseudonym_id: string;
  full_name: string;
  patient_code: string;
  birth_date: string | null;
  phone?: string | null;
  login_id?: string | null;
};

export async function listAdminPatientReportSummaries(sessionToken: string) {
  const context = await getAuthenticatedSessionContext(sessionToken);
  if (!context) {
    throw new Error("unauthorized");
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
      LEFT JOIN app_users au ON au.patient_id = pii.patient_id
      ORDER BY latest_activity_at DESC NULLS LAST, pii.created_at DESC
    `,
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

function mapAdminHistoryEntries(
  patient: AdminReportPatientRow,
  languageRows: any[],
  singRows: any[],
): TrainingHistoryEntry[] {
  const patientPseudonymId = String(patient.patient_pseudonym_id);

  return [
    ...languageRows.map((row: any) => ({
      historyId: row.source_history_id
        ? String(row.source_history_id)
        : String(row.result_id),
      sessionId: String(row.session_id),
      patientKey: patientPseudonymId,
      patientName: String(patient.full_name),
      birthDate: patient.birth_date ? String(patient.birth_date) : "",
      age: 0,
      educationYears: 0,
      place: "home",
      trainingMode: (row.training_mode === "rehab" ? "rehab" : "self") as TrainingMode,
      rehabStep: row.rehab_step == null ? undefined : Number(row.rehab_step),
      completedAt: new Date(row.completed_at).getTime(),
      aq: Number(row.aq ?? 0),
      stepScores: (row.step_scores as TrainingHistoryEntry["stepScores"]) ?? {
        step1: 0,
        step2: 0,
        step3: 0,
        step4: 0,
        step5: 0,
        step6: 0,
      },
      stepDetails: (row.step_details as TrainingHistoryEntry["stepDetails"]) ?? {
        step1: [],
        step2: [],
        step3: [],
        step4: [],
        step5: [],
        step6: [],
      },
      articulationScores:
        (row.articulation_scores as TrainingHistoryEntry["articulationScores"]) ??
        undefined,
      facialAnalysisSnapshot:
        (row.facial_analysis_snapshot as TrainingHistoryEntry["facialAnalysisSnapshot"]) ??
        undefined,
      measurementQuality:
        (row.measurement_quality as TrainingHistoryEntry["measurementQuality"]) ??
        undefined,
      stepVersionSnapshots:
        (row.step_version_snapshots as TrainingHistoryEntry["stepVersionSnapshots"]) ??
        undefined,
    })),
    ...singRows.map((row: any) => ({
      historyId: `history_sing_${String(row.result_id ?? new Date(row.completed_at).getTime())}`,
      sessionId: String(row.session_id),
      patientKey: patientPseudonymId,
      patientName: String(patient.full_name),
      birthDate: patient.birth_date ? String(patient.birth_date) : "",
      age: 0,
      educationYears: 0,
      place: "brain-sing",
      trainingMode: "sing" as TrainingMode,
      completedAt: new Date(row.completed_at).getTime(),
      aq: Number(row.score ?? 0),
      singResult: {
        song: String(row.song_key),
        score: Number(row.score ?? 0),
        finalJitter: row.jitter == null ? "-" : String(row.jitter),
        finalSi: row.facial_symmetry == null ? "-" : String(row.facial_symmetry),
        rtLatency: row.latency_ms == null ? "-" : String(row.latency_ms),
        finalConsonant:
          row.consonant_accuracy == null ? "-" : String(row.consonant_accuracy),
        finalVowel:
          row.vowel_accuracy == null ? "-" : String(row.vowel_accuracy),
        lyricAccuracy:
          row.lyric_accuracy == null ? "-" : String(row.lyric_accuracy),
        transcript:
          row.recognized_lyrics == null ? "" : String(row.recognized_lyrics),
        comment: row.comment ? String(row.comment) : "",
        rankings: [],
        versionSnapshot: row.version_snapshot ?? undefined,
      } satisfies SingHistoryResult,
      stepScores: {
        step1: 0,
        step2: 0,
        step3: 0,
        step4: 0,
        step5: 0,
        step6: 0,
      },
      stepDetails: {
        step1: [],
        step2: [],
        step3: [],
        step4: [],
        step5: [],
        step6: [],
      },
    })),
  ].sort((a, b) => b.completedAt - a.completedAt);
}

export async function listAdminReportValidationSample(sessionToken: string) {
  const context = await getAuthenticatedSessionContext(sessionToken);
  if (!context) {
    throw new Error("unauthorized");
  }

  const pool = getDbPool();
  const [patientsResult, languageRowsResult, singRowsResult] = await Promise.all([
    pool.query(
      `
        SELECT
          pii.patient_id::text AS patient_id,
          ppm.patient_pseudonym_id,
          pii.full_name,
          pii.patient_code,
          pii.birth_date::text AS birth_date,
          pii.phone,
          au.login_id
        FROM patient_pii pii
        JOIN patient_pseudonym_map ppm ON ppm.patient_id = pii.patient_id
        LEFT JOIN app_users au ON au.patient_id = pii.patient_id
      `,
    ),
    pool.query(
      `
        SELECT
          ltr.patient_pseudonym_id,
          cs.training_type,
          ltr.training_mode,
          ltr.rehab_step,
          cs.session_id::text AS session_id,
          ltr.result_id::text AS result_id,
          ltr.source_history_id,
          ltr.aq,
          cs.completed_at,
          ltr.created_at,
          ltr.step_scores,
          ltr.step_details,
          ltr.articulation_scores,
          ltr.facial_analysis_snapshot,
          ltr.measurement_quality,
          ltr.step_version_snapshots
        FROM language_training_results ltr
        JOIN clinical_sessions cs ON cs.session_id = ltr.session_id
        ORDER BY cs.completed_at DESC
      `,
    ),
    pool.query(
      `
        SELECT
          sr.patient_pseudonym_id,
          cs.training_type,
          cs.session_id::text AS session_id,
          sr.result_id::text AS result_id,
          sr.score,
          sr.song_key,
          sr.jitter,
          sr.facial_symmetry,
          sr.latency_ms,
          sr.consonant_accuracy,
          sr.vowel_accuracy,
          sr.lyric_accuracy,
          sr.recognized_lyrics,
          sr.comment,
          sr.version_snapshot,
          cs.completed_at
        FROM sing_results sr
        JOIN clinical_sessions cs ON cs.session_id = sr.session_id
        ORDER BY cs.completed_at DESC
      `,
    ),
  ]);

  const patientMap = new Map<string, AdminReportPatientRow>(
    patientsResult.rows.map((row: any) => [String(row.patient_pseudonym_id), row as AdminReportPatientRow]),
  );

  const languageByPatient = new Map<string, any[]>();
  for (const row of languageRowsResult.rows) {
    const key = String(row.patient_pseudonym_id);
    const list = languageByPatient.get(key) ?? [];
    list.push(row);
    languageByPatient.set(key, list);
  }

  const singByPatient = new Map<string, any[]>();
  for (const row of singRowsResult.rows) {
    const key = String(row.patient_pseudonym_id);
    const list = singByPatient.get(key) ?? [];
    list.push(row);
    singByPatient.set(key, list);
  }

  const allEntries: TrainingHistoryEntry[] = [];
  for (const [patientPseudonymId, patient] of patientMap.entries()) {
    allEntries.push(
      ...mapAdminHistoryEntries(
        patient,
        languageByPatient.get(patientPseudonymId) ?? [],
        singByPatient.get(patientPseudonymId) ?? [],
      ),
    );
  }

  return allEntries.sort((a, b) => b.completedAt - a.completedAt);
}

export async function getAdminPatientReportDetail(
  sessionToken: string,
  patientId: string,
) {
  const context = await getAuthenticatedSessionContext(sessionToken);
  if (!context) {
    throw new Error("unauthorized");
  }

  const pool = getDbPool();
  const patientResult = await pool.query(
    `
      SELECT
        pii.patient_id::text AS patient_id,
        ppm.patient_pseudonym_id,
        pii.full_name,
        pii.patient_code,
        pii.birth_date::text AS birth_date,
        pii.phone,
        au.login_id
      FROM patient_pii pii
      JOIN patient_pseudonym_map ppm ON ppm.patient_id = pii.patient_id
      LEFT JOIN app_users au ON au.patient_id = pii.patient_id
      WHERE pii.patient_id::text = $1
      LIMIT 1
    `,
    [patientId],
  );

  const patient = patientResult.rows[0];
  if (!patient) {
    throw new Error("patient_not_found");
  }

  const patientPseudonymId = String(patient.patient_pseudonym_id);
  const [languageRows, singRows] = await Promise.all([
    pool.query(
      `
        SELECT
          cs.training_type,
          ltr.training_mode,
          ltr.rehab_step,
          cs.session_id::text AS session_id,
          ltr.result_id::text AS result_id,
          ltr.source_history_id,
          ltr.aq,
          cs.completed_at,
          ltr.created_at,
          ltr.step_scores,
          ltr.step_details,
          ltr.articulation_scores,
          ltr.facial_analysis_snapshot,
          ltr.measurement_quality,
          ltr.step_version_snapshots
        FROM language_training_results ltr
        JOIN clinical_sessions cs ON cs.session_id = ltr.session_id
        WHERE ltr.patient_pseudonym_id = $1
        ORDER BY cs.completed_at DESC
      `,
      [patientPseudonymId],
    ),
    pool.query(
      `
        SELECT
          cs.training_type,
          cs.session_id::text AS session_id,
          sr.result_id::text AS result_id,
          sr.score,
          sr.song_key,
          sr.jitter,
          sr.facial_symmetry,
          sr.latency_ms,
          sr.consonant_accuracy,
          sr.vowel_accuracy,
          sr.lyric_accuracy,
          sr.recognized_lyrics,
          sr.comment,
          sr.version_snapshot,
          cs.completed_at
        FROM sing_results sr
        JOIN clinical_sessions cs ON cs.session_id = sr.session_id
        WHERE sr.patient_pseudonym_id = $1
        ORDER BY cs.completed_at DESC
      `,
      [patientPseudonymId],
    ),
  ]);

  const entries = mapAdminHistoryEntries(
    patient as AdminReportPatientRow,
    languageRows.rows,
    singRows.rows,
  );

  return {
    requestedBy: {
      userId: context.userId,
      patientName: context.patient.name,
    },
    patient: {
      patientId: String(patient.patient_id),
      patientPseudonymId,
      patientName: String(patient.full_name),
      patientCode: String(patient.patient_code),
      loginId: patient.login_id ? String(patient.login_id) : null,
      birthDate: patient.birth_date ? String(patient.birth_date) : null,
      phone: patient.phone ? String(patient.phone) : null,
    },
    entries,
  };
}
