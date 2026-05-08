import {
  collectAdaptiveEvidence,
  serializeAdaptiveEvidenceCsv,
  serializeAdaptiveEvidenceItemSummaryCsv,
  serializeAdaptiveEvidenceSessionSummaryCsv,
  summarizeAdaptiveEvidenceRows,
} from "@/lib/adaptive/evidence";
import type { TrainingHistoryEntry, TrainingMode } from "@/lib/kwab/SessionManager";
import { getDbPool } from "@/lib/server/postgres";

type EvidenceLoadStatus =
  | {
      ok: true;
      source: "database";
      error: null;
      note: string;
    }
  | {
      ok: false;
      source: "unavailable";
      error: string;
      note: string;
    };

function toStepDetails(value: unknown): TrainingHistoryEntry["stepDetails"] {
  const details = (value ?? {}) as Partial<TrainingHistoryEntry["stepDetails"]>;
  return {
    step1: Array.isArray(details.step1) ? details.step1 : [],
    step2: Array.isArray(details.step2) ? details.step2 : [],
    step3: Array.isArray(details.step3) ? details.step3 : [],
    step4: Array.isArray(details.step4) ? details.step4 : [],
    step5: Array.isArray(details.step5) ? details.step5 : [],
    step6: Array.isArray(details.step6) ? details.step6 : [],
  };
}

function mapLanguageRow(row: any): TrainingHistoryEntry {
  return {
    historyId: row.source_history_id ? String(row.source_history_id) : String(row.result_id),
    sessionId: String(row.session_id),
    patientKey: String(row.patient_pseudonym_id ?? "unknown"),
    patientName: String(row.patient_code ?? "pseudonymized"),
    birthDate: "",
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
    stepDetails: toStepDetails(row.step_details),
    measurementQuality:
      (row.measurement_quality as TrainingHistoryEntry["measurementQuality"]) ??
      undefined,
    stepVersionSnapshots:
      (row.step_version_snapshots as TrainingHistoryEntry["stepVersionSnapshots"]) ??
      undefined,
  };
}

function buildUnavailableFixture() {
  const now = Date.UTC(2026, 4, 6, 0, 0, 0);
  return [
    {
      historyId: "fixture-adaptive-1",
      sessionId: "fixture-session-1",
      patientKey: "fixture-patient",
      patientName: "pseudonymized",
      birthDate: "",
      age: 0,
      educationYears: 0,
      place: "home",
      trainingMode: "rehab",
      rehabStep: 5,
      completedAt: now,
      aq: 0,
      stepScores: { step1: 0, step2: 0, step3: 0, step4: 0, step5: 70, step6: 0 },
      stepDetails: {
        step1: [],
        step2: [],
        step3: [],
        step4: [],
        step5: [
          {
            text: "연습 문항 A",
            isCorrect: true,
            adaptiveItemKey: "home-1",
            adaptiveItemId: "step5-home-1",
            adaptiveTheta: 0.12,
            adaptiveSd: 0.82,
            itemDifficulty: 0.05,
            itemDiscrimination: 1,
            adaptiveSelectionMethod: "irt_mfi",
          },
          {
            text: "연습 문항 B",
            isCorrect: false,
            adaptiveItemKey: "home-2",
            adaptiveItemId: "step5-home-2",
            adaptiveTheta: 0.21,
            adaptiveSd: 0.77,
            itemDifficulty: 0.5,
            itemDiscrimination: 1.1,
            adaptiveSelectionMethod: "irt_mfi",
          },
        ],
        step6: [],
      },
    } satisfies TrainingHistoryEntry,
  ];
}

async function loadAdaptiveEntries() {
  const pool = getDbPool();
  const result = await pool.query(
    `
      SELECT
        ltr.patient_pseudonym_id,
        ltr.training_mode,
        ltr.rehab_step,
        cs.session_id::text AS session_id,
        ltr.result_id::text AS result_id,
        ltr.source_history_id,
        ltr.aq,
        cs.completed_at,
        ltr.step_scores,
        ltr.step_details,
        ltr.measurement_quality,
        ltr.step_version_snapshots
      FROM language_training_results ltr
      JOIN clinical_sessions cs ON cs.session_id = ltr.session_id
      WHERE ltr.step_details IS NOT NULL
      ORDER BY cs.completed_at DESC
      LIMIT 500
    `,
  );
  return result.rows.map(mapLanguageRow);
}

export async function buildAdaptiveEvidenceExport() {
  let entries: TrainingHistoryEntry[];
  let loadStatus: EvidenceLoadStatus;

  try {
    entries = await loadAdaptiveEntries();
    loadStatus = {
      ok: true,
      source: "database",
      error: null,
      note: "Adaptive evidence was loaded from language_training_results.step_details.",
    };
  } catch (error) {
    entries = buildUnavailableFixture();
    loadStatus = {
      ok: false,
      source: "unavailable",
      error: error instanceof Error ? error.message : String(error),
      note: "Database evidence is unavailable. The export includes deterministic fixture rows so the file schema can be reviewed.",
    };
  }

  const evidenceRows = entries.flatMap(collectAdaptiveEvidence);
  const aggregate = summarizeAdaptiveEvidenceRows(evidenceRows);
  const evidenceCsv = serializeAdaptiveEvidenceCsv(evidenceRows);
  const itemSummaryCsv = serializeAdaptiveEvidenceItemSummaryCsv(aggregate.itemSummaries);
  const sessionSummaryCsv = serializeAdaptiveEvidenceSessionSummaryCsv(
    aggregate.sessionSummaries,
  );

  return {
    exportType: "brainfriends-adaptive-irt-evidence",
    generatedAt: new Date().toISOString(),
    documentControl: {
      documentType: "IRT/Bayesian Adaptive Evidence Package",
      productName: "BrainFriends",
      exportFileName: "brainfriends-adaptive-irt-evidence.json",
    },
    intendedUseBoundary: {
      role: "therapist_review_support",
      statement:
        "IRT theta, item difficulty, and MFI selection metadata are review indicators for therapists. They do not automatically diagnose, prescribe, or determine treatment.",
    },
    loadStatus,
    summary: aggregate,
    tables: {
      adaptiveEvidenceRows: evidenceRows,
      itemSummaryTable: aggregate.itemSummaries,
      sessionSummaryTable: aggregate.sessionSummaries,
    },
    csv: {
      adaptiveEvidenceCsv: evidenceCsv,
      itemSummaryCsv,
      sessionSummaryCsv,
    },
  };
}
