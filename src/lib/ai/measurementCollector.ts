import type { TrainingHistoryEntry } from "@/lib/kwab/SessionManager";
import { ACTIVE_MODEL_GOVERNANCE } from "./modelGovernance";
import { canEnterOfficialEvaluation } from "./evaluationDataset";
import type { SpeechFaceMeasurement } from "./measurementTypes";

export interface MeasurementCollectionResult {
  accepted: boolean;
  sent: number;
  reason?: string;
}

function numberOrZero(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildSamplesFromHistory(
  historyEntry: TrainingHistoryEntry,
): SpeechFaceMeasurement[] {
  const capturedAt = new Date(historyEntry.completedAt).toISOString();
  const trackingQuality = numberOrZero(
    historyEntry.facialAnalysisSnapshot?.trackingQuality,
  );

  const buildStepSamples = (
    stepNo: 2 | 4 | 5,
    rows: any[],
  ): SpeechFaceMeasurement[] =>
    rows.map((row, index) => ({
      utteranceId: `${historyEntry.historyId}-step${stepNo}-${index + 1}`,
      historyId: historyEntry.historyId,
      sessionId: historyEntry.sessionId,
      patientId: historyEntry.patientKey,
      trainingMode: historyEntry.trainingMode === "rehab" ? "rehab" : "self",
      rehabStep: historyEntry.rehabStep ?? null,
      prompt: String(
        row?.prompt ?? row?.situation ?? row?.text ?? `step${stepNo}`,
      ),
      transcript: String(row?.transcript ?? "").trim(),
      consonantAccuracy: numberOrZero(row?.consonantAccuracy),
      vowelAccuracy: numberOrZero(row?.vowelAccuracy),
      pronunciationScore: numberOrZero(
        row?.pronunciationScore ?? row?.readingScore ?? row?.finalScore,
      ),
      symmetryScore: numberOrZero(row?.symmetryScore),
      trackingQuality,
      processingMs: numberOrZero(row?.processingMs),
      fps: numberOrZero(row?.fps),
      quality: historyEntry.measurementQuality?.overall ?? "demo",
      modelVersion: ACTIVE_MODEL_GOVERNANCE.modelVersion,
      analysisVersion: ACTIVE_MODEL_GOVERNANCE.analysisVersion,
      evaluationDatasetVersion:
        ACTIVE_MODEL_GOVERNANCE.evaluationDatasetVersion,
      capturedAt,
    }));

  return [
    ...buildStepSamples(2, historyEntry.stepDetails?.step2 ?? []),
    ...buildStepSamples(4, historyEntry.stepDetails?.step4 ?? []),
    ...buildStepSamples(5, historyEntry.stepDetails?.step5 ?? []),
  ];
}

export async function collectHistoryMeasurementsForEvaluation(
  historyEntry: TrainingHistoryEntry,
): Promise<MeasurementCollectionResult> {
  const samples = buildSamplesFromHistory(historyEntry).filter((sample) =>
    canEnterOfficialEvaluation(sample),
  );

  if (samples.length === 0) {
    return {
      accepted: false,
      sent: 0,
      reason: "no_measured_samples",
    };
  }

  const response = await fetch("/api/evaluation-samples", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      historyId: historyEntry.historyId,
      sessionId: historyEntry.sessionId,
      samples,
      governance: ACTIVE_MODEL_GOVERNANCE,
    }),
    keepalive: true,
  });

  if (!response.ok) {
    return {
      accepted: false,
      sent: 0,
      reason: "failed_to_persist_evaluation_samples",
    };
  }

  return {
    accepted: true,
    sent: samples.length,
  };
}
