import type { PatientProfile } from "@/lib/patientStorage";
import type { TrainingHistoryEntry } from "@/lib/kwab/SessionManager";

export type PersistClinicalHistoryResult = {
  saved?: {
    patientId: string;
    patientCode: string;
    patientPseudonymId: string;
    sessionId: string;
    resultId: string;
    trainingType: string;
  };
  skipped: boolean;
};

const CLINICAL_SYNC_PREFIX = "clinical-db-sync:";

function getPersistKey(entry: TrainingHistoryEntry) {
  return `${CLINICAL_SYNC_PREFIX}${entry.historyId}`;
}

export async function persistTrainingHistoryToDatabase(
  patient: PatientProfile,
  historyEntry: TrainingHistoryEntry,
): Promise<PersistClinicalHistoryResult> {
  if (typeof window !== "undefined") {
    const cached = window.sessionStorage.getItem(getPersistKey(historyEntry));
    if (cached) {
      return JSON.parse(cached) as PersistClinicalHistoryResult;
    }
  }

  const response = await fetch("/api/clinical-results", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ patient, historyEntry }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || "failed_to_persist_clinical_result");
  }

  const normalized: PersistClinicalHistoryResult = {
    saved: payload?.saved,
    skipped: Boolean(payload?.skipped),
  };

  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(
      getPersistKey(historyEntry),
      JSON.stringify(normalized),
    );
  }

  return normalized;
}
