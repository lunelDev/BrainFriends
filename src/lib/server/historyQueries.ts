import { getDbPool } from "@/lib/server/postgres";
import { buildPatientProfile, getAuthenticatedSessionContext } from "@/lib/server/accountAuth";
import type {
  SingHistoryResult,
  TrainingMode,
  TrainingHistoryEntry,
} from "@/lib/kwab/SessionManager";

export type AuthenticatedHistoryContext = {
  userId: string;
  patientId: string;
  patientPseudonymId: string;
};

export type TrainingHistorySummary = {
  kind: "language-training" | "sing-training";
  trainingType: string;
  trainingMode: string | null;
  rehabStep: number | null;
  sessionId: string;
  resultId: string;
  sourceHistoryId: string | null;
  aq: number | null;
  score: number | null;
  songKey: string | null;
  completedAt: string;
  createdAt: string;
  stepScores: Record<string, number> | null;
  versionSnapshot: Record<string, unknown> | null;
};

export async function getAuthenticatedHistoryContext(sessionToken: string) {
  return getAuthenticatedSessionContext(sessionToken);
}

export async function listHistoryForAuthenticatedUser(
  sessionToken: string,
): Promise<{
  patient: ReturnType<typeof buildPatientProfile>;
  history: TrainingHistorySummary[];
  entries: TrainingHistoryEntry[];
}> {
  const context = await getAuthenticatedSessionContext(sessionToken);
  if (!context) {
    throw new Error("unauthorized");
  }

  const pool = getDbPool();
  const [languageRows, singRows] = await Promise.all([
    pool.query(
      `
        SELECT
          'language-training' AS kind,
          cs.training_type,
          ltr.training_mode,
          ltr.rehab_step,
          cs.session_id::text AS session_id,
          ltr.result_id::text AS result_id,
          ltr.source_history_id,
          ltr.aq,
          NULL::numeric AS score,
          NULL::text AS song_key,
          cs.completed_at,
          ltr.created_at,
          ltr.step_scores,
          ltr.step_details,
          ltr.articulation_scores,
          ltr.facial_analysis_snapshot,
          ltr.measurement_quality,
          ltr.step_version_snapshots,
          NULL::numeric AS jitter,
          NULL::numeric AS facial_symmetry,
          NULL::numeric AS latency_ms,
          NULL::text AS comment,
          cs.version_snapshot
        FROM language_training_results ltr
        JOIN clinical_sessions cs ON cs.session_id = ltr.session_id
        WHERE ltr.patient_pseudonym_id = $1
      `,
      [context.patientPseudonymId],
    ),
    pool.query(
      `
        SELECT
          'sing-training' AS kind,
          cs.training_type,
          NULL::text AS training_mode,
          NULL::integer AS rehab_step,
          cs.session_id::text AS session_id,
          sr.result_id::text AS result_id,
          NULL::text AS source_history_id,
          NULL::numeric AS aq,
          sr.score,
          sr.song_key,
          cs.completed_at,
          sr.created_at,
          NULL::jsonb AS step_scores,
          NULL::jsonb AS step_details,
          NULL::jsonb AS articulation_scores,
          NULL::jsonb AS facial_analysis_snapshot,
          NULL::jsonb AS step_version_snapshots,
          sr.jitter,
          sr.facial_symmetry,
          sr.latency_ms,
          sr.consonant_accuracy,
          sr.vowel_accuracy,
          sr.lyric_accuracy,
          sr.recognized_lyrics,
          sr.comment,
          sr.version_snapshot
        FROM sing_results sr
        JOIN clinical_sessions cs ON cs.session_id = sr.session_id
        WHERE sr.patient_pseudonym_id = $1
      `,
      [context.patientPseudonymId],
    ),
  ]);

  const history = [...languageRows.rows, ...singRows.rows]
    .map((row: any) => ({
      kind: row.kind as "language-training" | "sing-training",
      trainingType: String(row.training_type),
      trainingMode: row.training_mode ? String(row.training_mode) : null,
      rehabStep:
        row.rehab_step == null ? null : Number(row.rehab_step),
      sessionId: String(row.session_id),
      resultId: String(row.result_id),
      sourceHistoryId: row.source_history_id ? String(row.source_history_id) : null,
      aq: row.aq == null ? null : Number(row.aq),
      score: row.score == null ? null : Number(row.score),
      songKey: row.song_key ? String(row.song_key) : null,
      completedAt: new Date(row.completed_at).toISOString(),
      createdAt: new Date(row.created_at).toISOString(),
      stepScores: row.step_scores ? (row.step_scores as Record<string, number>) : null,
      versionSnapshot: row.version_snapshot
        ? (row.version_snapshot as Record<string, unknown>)
        : null,
    }))
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));

  const patient = context.patient;
  const entries: TrainingHistoryEntry[] = [
    ...languageRows.rows.map((row: any) => ({
      historyId: row.source_history_id
        ? String(row.source_history_id)
        : String(row.result_id),
      sessionId: String(row.session_id),
      patientKey: context.patientPseudonymId,
      patientName: patient.name,
      birthDate: patient.birthDate,
      age: Number(patient.age ?? 0),
      educationYears: Number(patient.educationYears ?? 0),
      place: "home",
      trainingMode: (
        row.training_mode === "rehab"
          ? "rehab"
          : "self"
      ) as TrainingMode,
      rehabStep:
        row.rehab_step == null ? undefined : Number(row.rehab_step),
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
    ...singRows.rows.map((row: any) => ({
      historyId: `history_sing_${new Date(row.completed_at).getTime()}`,
      sessionId: String(row.session_id),
      patientKey: context.patientPseudonymId,
      patientName: patient.name,
      birthDate: patient.birthDate,
      age: Number(patient.age ?? 0),
      educationYears: Number(patient.educationYears ?? 0),
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

  return {
    patient,
    history,
    entries,
  };
}

export async function getOnboardingStatusForAuthenticatedUser(sessionToken: string) {
  const context = await getAuthenticatedSessionContext(sessionToken);
  if (!context) {
    throw new Error("unauthorized");
  }

  const pool = getDbPool();
  const selfAssessmentCount = await pool.query(
    `
      SELECT COUNT(*)::int AS row_count
      FROM language_training_results ltr
      JOIN clinical_sessions cs ON cs.session_id = ltr.session_id
      WHERE ltr.patient_pseudonym_id = $1
        AND cs.training_type = 'self-assessment'
    `,
    [context.patientPseudonymId],
  );

  return {
    patient: context.patient,
    hasSelfAssessmentHistory: Number(selfAssessmentCount.rows[0]?.row_count ?? 0) > 0,
  };
}

export async function deleteHistoryEntriesForAuthenticatedUser(
  sessionToken: string,
  sessionIds: string[],
) {
  const context = await getAuthenticatedSessionContext(sessionToken);
  if (!context) {
    throw new Error("unauthorized");
  }

  const normalizedSessionIds = Array.from(
    new Set(
      sessionIds
        .map((value) => String(value || "").trim())
        .filter((value) => value.length > 0),
    ),
  );

  if (!normalizedSessionIds.length) {
    return { deletedCount: 0 };
  }

  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const eligibleSessions = await client.query(
      `
        SELECT session_id::text AS session_id
        FROM clinical_sessions
        WHERE patient_pseudonym_id = $1
          AND session_id::text = ANY($2::text[])
      `,
      [context.patientPseudonymId, normalizedSessionIds],
    );

    const ownedSessionIds = eligibleSessions.rows.map((row: any) =>
      String(row.session_id),
    );

    if (!ownedSessionIds.length) {
      await client.query("COMMIT");
      return { deletedCount: 0 };
    }

    await client.query(
      `
        DELETE FROM clinical_media_objects
        WHERE patient_pseudonym_id = $1
          AND clinical_session_id::text = ANY($2::text[])
      `,
      [context.patientPseudonymId, ownedSessionIds],
    );

    await client.query(
      `
        DELETE FROM language_training_results
        WHERE patient_pseudonym_id = $1
          AND session_id::text = ANY($2::text[])
      `,
      [context.patientPseudonymId, ownedSessionIds],
    );

    await client.query(
      `
        DELETE FROM sing_results
        WHERE patient_pseudonym_id = $1
          AND session_id::text = ANY($2::text[])
      `,
      [context.patientPseudonymId, ownedSessionIds],
    );

    await client.query(
      `
        DELETE FROM clinical_sessions
        WHERE patient_pseudonym_id = $1
          AND session_id::text = ANY($2::text[])
      `,
      [context.patientPseudonymId, ownedSessionIds],
    );

    await client.query("COMMIT");
    return { deletedCount: ownedSessionIds.length };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
