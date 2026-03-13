import type { PatientProfile } from "@/lib/patientStorage";
import type { TrainingHistoryEntry } from "@/lib/kwab/SessionManager";
import type { VersionSnapshot } from "@/lib/analysis/versioning";
import { getDbPool } from "@/lib/server/postgres";
import {
  deterministicUuid,
  upsertPatientIdentity,
} from "@/lib/server/patientIdentityDb";

function sanitizeStepDetails(details: TrainingHistoryEntry["stepDetails"]) {
  const sanitizeItems = (items: any[]) =>
    (Array.isArray(items) ? items : []).map((item) => ({
      ...item,
      audioUrl: undefined,
      userImage: undefined,
      cameraFrameImage: undefined,
      cameraFrameFrames: undefined,
      imageData: undefined,
    }));

  return {
    step1: sanitizeItems(details?.step1 ?? []),
    step2: sanitizeItems(details?.step2 ?? []),
    step3: sanitizeItems(details?.step3 ?? []),
    step4: sanitizeItems(details?.step4 ?? []),
    step5: sanitizeItems(details?.step5 ?? []),
    step6: sanitizeItems(details?.step6 ?? []),
  };
}

function pickRepresentativeSnapshot(
  entry: TrainingHistoryEntry,
): VersionSnapshot | null {
  if (entry.rehabStep) {
    const rehabKey = `step${entry.rehabStep}` as keyof NonNullable<
      TrainingHistoryEntry["stepVersionSnapshots"]
    >;
    return entry.stepVersionSnapshots?.[rehabKey] ?? null;
  }

  const orderedKeys: Array<keyof NonNullable<TrainingHistoryEntry["stepVersionSnapshots"]>> = [
    "step6",
    "step5",
    "step4",
    "step3",
    "step2",
    "step1",
  ];

  for (const key of orderedKeys) {
    const snapshot = entry.stepVersionSnapshots?.[key];
    if (snapshot) return snapshot;
  }

  return null;
}

function buildTrainingType(entry: TrainingHistoryEntry) {
  return entry.trainingMode === "rehab" ? "speech-rehab" : "self-assessment";
}

export async function saveTrainingHistoryToDatabase(params: {
  patient: PatientProfile;
  historyEntry: TrainingHistoryEntry;
}) {
  const { patient, historyEntry } = params;
  const pool = getDbPool();
  const client = await pool.connect();


  const trainingType = buildTrainingType(historyEntry);
  const sessionUuid = deterministicUuid(
    `clinical-session:${historyEntry.sessionId}:${historyEntry.historyId}:${trainingType}`,
  );
  const resultId = deterministicUuid(
    `training-result:${historyEntry.historyId}:${trainingType}`,
  );
  const completedAt = new Date(historyEntry.completedAt);
  const representativeSnapshot = pickRepresentativeSnapshot(historyEntry);
  const safeStepDetails = sanitizeStepDetails(historyEntry.stepDetails);

  try {
    await client.query("BEGIN");

    const { patientId, patientCode, patientPseudonymId } =
      await upsertPatientIdentity(client, patient);

    await client.query(
      `
        INSERT INTO clinical_sessions (
          session_id,
          patient_pseudonym_id,
          training_type,
          source_session_key,
          started_at,
          completed_at,
          algorithm_version,
          catalog_version,
          release_version,
          status,
          version_snapshot,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, NOW())
        ON CONFLICT (session_id) DO UPDATE
        SET
          training_type = EXCLUDED.training_type,
          source_session_key = EXCLUDED.source_session_key,
          completed_at = EXCLUDED.completed_at,
          algorithm_version = EXCLUDED.algorithm_version,
          catalog_version = EXCLUDED.catalog_version,
          release_version = EXCLUDED.release_version,
          status = EXCLUDED.status,
          version_snapshot = EXCLUDED.version_snapshot
      `,
      [
        sessionUuid,
        patientPseudonymId,
        trainingType,
        historyEntry.sessionId,
        completedAt,
        completedAt,
        representativeSnapshot?.algorithm_version ?? `${trainingType}-unknown`,
        representativeSnapshot?.config_version ?? null,
        representativeSnapshot?.release_version ?? null,
        "completed",
        representativeSnapshot ? JSON.stringify(representativeSnapshot) : null,
      ],
    );

    await client.query(
      `
        INSERT INTO language_training_results (
          result_id,
          session_id,
          patient_pseudonym_id,
          training_mode,
          rehab_step,
          aq,
          step_scores,
          step_details,
          articulation_scores,
          facial_analysis_snapshot,
          step_version_snapshots,
          source_history_id,
          created_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7::jsonb,
          $8::jsonb,
          $9::jsonb,
          $10::jsonb,
          $11::jsonb,
          $12,
          NOW()
        )
        ON CONFLICT (result_id) DO UPDATE
        SET
          training_mode = EXCLUDED.training_mode,
          rehab_step = EXCLUDED.rehab_step,
          aq = EXCLUDED.aq,
          step_scores = EXCLUDED.step_scores,
          step_details = EXCLUDED.step_details,
          articulation_scores = EXCLUDED.articulation_scores,
          facial_analysis_snapshot = EXCLUDED.facial_analysis_snapshot,
          step_version_snapshots = EXCLUDED.step_version_snapshots,
          source_history_id = EXCLUDED.source_history_id
      `,
      [
        resultId,
        sessionUuid,
        patientPseudonymId,
        historyEntry.trainingMode ?? "self",
        historyEntry.rehabStep ?? null,
        historyEntry.aq,
        JSON.stringify(historyEntry.stepScores),
        JSON.stringify(safeStepDetails),
        JSON.stringify(historyEntry.articulationScores ?? null),
        JSON.stringify(historyEntry.facialAnalysisSnapshot ?? null),
        JSON.stringify(historyEntry.stepVersionSnapshots ?? null),
        historyEntry.historyId,
      ],
    );

    await client.query("COMMIT");

    return {
      patientId,
      patientCode,
      patientPseudonymId,
      sessionId: sessionUuid,
      resultId,
      trainingType,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

