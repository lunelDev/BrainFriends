import { appendFile, mkdir } from "fs/promises";
import path from "path";
import type { PoolClient } from "pg";
import type { SpeechFaceMeasurement } from "@/lib/ai/measurementTypes";
import type { ModelGovernanceRecord } from "@/lib/ai/modelGovernance";
import { getDbPool } from "@/lib/server/postgres";
import { deterministicUuid, hashValue } from "@/lib/server/patientIdentityDb";

export type SaveEvaluationSamplesParams = {
  historyId: string;
  sessionId: string;
  samples: SpeechFaceMeasurement[];
  governance?: ModelGovernanceRecord | null;
};

function buildEvaluationSampleId(sample: SpeechFaceMeasurement) {
  return deterministicUuid(
    `evaluation-sample:${sample.historyId}:${sample.utteranceId}:${sample.evaluationDatasetVersion}`,
  );
}

function buildPatientPseudonymIdFromSample(sample: SpeechFaceMeasurement) {
  return `eval_${hashValue(`patient:${sample.patientId}`).slice(0, 24)}`;
}

async function ensureEvaluationSamplesTable(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ai_evaluation_samples (
      sample_id uuid PRIMARY KEY,
      source_history_id text NOT NULL,
      source_session_id text NOT NULL,
      patient_pseudonym_id text NOT NULL,
      training_mode text NOT NULL,
      rehab_step integer NULL,
      utterance_id text NOT NULL,
      quality text NOT NULL,
      prompt_text text NOT NULL,
      transcript_text text NOT NULL,
      consonant_accuracy double precision NOT NULL DEFAULT 0,
      vowel_accuracy double precision NOT NULL DEFAULT 0,
      pronunciation_score double precision NOT NULL DEFAULT 0,
      symmetry_score double precision NOT NULL DEFAULT 0,
      tracking_quality double precision NOT NULL DEFAULT 0,
      processing_ms double precision NOT NULL DEFAULT 0,
      fps double precision NOT NULL DEFAULT 0,
      model_version text NOT NULL,
      analysis_version text NOT NULL,
      evaluation_dataset_version text NOT NULL,
      captured_at timestamptz NOT NULL,
      governance jsonb NULL,
      sample_payload jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW(),
      UNIQUE (source_history_id, utterance_id)
    )
  `);
}

export async function appendEvaluationSamplesToFile(
  params: SaveEvaluationSamplesParams,
) {
  const evaluationDir = path.join(process.cwd(), "data", "evaluation");
  const evaluationPath = path.join(evaluationDir, "evaluation-samples.ndjson");
  await mkdir(evaluationDir, { recursive: true });

  const records = params.samples.map((sample) =>
    JSON.stringify({
      historyId: params.historyId,
      sessionId: params.sessionId,
      governance: params.governance ?? null,
      sample,
      recordedAt: new Date().toISOString(),
    }),
  );

  await appendFile(evaluationPath, `${records.join("\n")}\n`, "utf8");
  return {
    accepted: params.samples.length,
    storageTarget: "file" as const,
    path: evaluationPath,
  };
}

export async function saveEvaluationSamplesToDatabase(
  params: SaveEvaluationSamplesParams,
) {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await ensureEvaluationSamplesTable(client);

    for (const sample of params.samples) {
      await client.query(
        `
          INSERT INTO ai_evaluation_samples (
            sample_id,
            source_history_id,
            source_session_id,
            patient_pseudonym_id,
            training_mode,
            rehab_step,
            utterance_id,
            quality,
            prompt_text,
            transcript_text,
            consonant_accuracy,
            vowel_accuracy,
            pronunciation_score,
            symmetry_score,
            tracking_quality,
            processing_ms,
            fps,
            model_version,
            analysis_version,
            evaluation_dataset_version,
            captured_at,
            governance,
            sample_payload,
            updated_at
          )
          VALUES (
            $1::uuid,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13,
            $14,
            $15,
            $16,
            $17,
            $18,
            $19,
            $20,
            $21::timestamptz,
            $22::jsonb,
            $23::jsonb,
            NOW()
          )
          ON CONFLICT (source_history_id, utterance_id) DO UPDATE
          SET
            source_session_id = EXCLUDED.source_session_id,
            patient_pseudonym_id = EXCLUDED.patient_pseudonym_id,
            training_mode = EXCLUDED.training_mode,
            rehab_step = EXCLUDED.rehab_step,
            quality = EXCLUDED.quality,
            prompt_text = EXCLUDED.prompt_text,
            transcript_text = EXCLUDED.transcript_text,
            consonant_accuracy = EXCLUDED.consonant_accuracy,
            vowel_accuracy = EXCLUDED.vowel_accuracy,
            pronunciation_score = EXCLUDED.pronunciation_score,
            symmetry_score = EXCLUDED.symmetry_score,
            tracking_quality = EXCLUDED.tracking_quality,
            processing_ms = EXCLUDED.processing_ms,
            fps = EXCLUDED.fps,
            model_version = EXCLUDED.model_version,
            analysis_version = EXCLUDED.analysis_version,
            evaluation_dataset_version = EXCLUDED.evaluation_dataset_version,
            captured_at = EXCLUDED.captured_at,
            governance = EXCLUDED.governance,
            sample_payload = EXCLUDED.sample_payload,
            updated_at = NOW()
        `,
        [
          buildEvaluationSampleId(sample),
          params.historyId,
          params.sessionId,
          buildPatientPseudonymIdFromSample(sample),
          sample.trainingMode,
          sample.rehabStep,
          sample.utteranceId,
          sample.quality,
          sample.prompt,
          sample.transcript,
          sample.consonantAccuracy,
          sample.vowelAccuracy,
          sample.pronunciationScore,
          sample.symmetryScore,
          sample.trackingQuality,
          sample.processingMs,
          sample.fps,
          sample.modelVersion,
          sample.analysisVersion,
          sample.evaluationDatasetVersion,
          sample.capturedAt,
          params.governance ? JSON.stringify(params.governance) : null,
          JSON.stringify(sample),
        ],
      );
    }

    await client.query("COMMIT");
    return {
      accepted: params.samples.length,
      storageTarget: "database" as const,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getEvaluationSamplesSummary() {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await ensureEvaluationSamplesTable(client);
    const [summaryResult, versionResult, modeResult, qualityResult] = await Promise.all([
      client.query(`
        SELECT
          COUNT(*)::int AS total_count,
          COUNT(*) FILTER (WHERE quality = 'measured')::int AS measured_count,
          MAX(captured_at)::text AS latest_captured_at
        FROM ai_evaluation_samples
      `),
      client.query(`
        SELECT
          evaluation_dataset_version,
          model_version,
          analysis_version,
          COUNT(*)::int AS sample_count,
          MAX(captured_at)::text AS latest_captured_at,
          AVG(pronunciation_score)::double precision AS avg_pronunciation_score,
          AVG(consonant_accuracy)::double precision AS avg_consonant_accuracy,
          AVG(vowel_accuracy)::double precision AS avg_vowel_accuracy,
          AVG(tracking_quality)::double precision AS avg_tracking_quality
        FROM ai_evaluation_samples
        GROUP BY evaluation_dataset_version, model_version, analysis_version
        ORDER BY latest_captured_at DESC NULLS LAST
        LIMIT 10
      `),
      client.query(`
        SELECT
          training_mode,
          COUNT(*)::int AS sample_count
        FROM ai_evaluation_samples
        GROUP BY training_mode
        ORDER BY sample_count DESC, training_mode ASC
      `),
      client.query(`
        SELECT
          quality,
          COUNT(*)::int AS sample_count
        FROM ai_evaluation_samples
        GROUP BY quality
        ORDER BY sample_count DESC, quality ASC
      `),
    ]);

    const summaryRow = summaryResult.rows[0] ?? {};
    const versions = versionResult.rows.map((row: any) => ({
      evaluationDatasetVersion: String(row.evaluation_dataset_version),
      modelVersion: String(row.model_version),
      analysisVersion: String(row.analysis_version),
      sampleCount: Number(row.sample_count ?? 0),
      latestCapturedAt: row.latest_captured_at
        ? String(row.latest_captured_at)
        : null,
      avgPronunciationScore: Number(row.avg_pronunciation_score ?? 0),
      avgConsonantAccuracy: Number(row.avg_consonant_accuracy ?? 0),
      avgVowelAccuracy: Number(row.avg_vowel_accuracy ?? 0),
      avgTrackingQuality: Number(row.avg_tracking_quality ?? 0),
    }));
    const latestVersion = versions[0] ?? null;
    const previousVersion = versions[1] ?? null;

    return {
      totalCount: Number(summaryRow.total_count ?? 0),
      measuredCount: Number(summaryRow.measured_count ?? 0),
      latestCapturedAt: summaryRow.latest_captured_at
        ? String(summaryRow.latest_captured_at)
        : null,
      versions,
      latestVersionComparison:
        latestVersion && previousVersion
          ? {
              current: latestVersion,
              previous: previousVersion,
              sampleDelta: latestVersion.sampleCount - previousVersion.sampleCount,
              pronunciationDelta:
                latestVersion.avgPronunciationScore -
                previousVersion.avgPronunciationScore,
              consonantDelta:
                latestVersion.avgConsonantAccuracy -
                previousVersion.avgConsonantAccuracy,
              vowelDelta:
                latestVersion.avgVowelAccuracy - previousVersion.avgVowelAccuracy,
              trackingDelta:
                latestVersion.avgTrackingQuality -
                previousVersion.avgTrackingQuality,
            }
          : null,
      modeBreakdown: modeResult.rows.map((row: any) => ({
        trainingMode: String(row.training_mode),
        sampleCount: Number(row.sample_count ?? 0),
      })),
      qualityBreakdown: qualityResult.rows.map((row: any) => ({
        quality: String(row.quality),
        sampleCount: Number(row.sample_count ?? 0),
      })),
    };
  } finally {
    client.release();
  }
}
