import type { PatientProfile } from "@/lib/patientStorage";
import type { TrainingHistoryEntry } from "@/lib/kwab/SessionManager";
import { dataUrlToBlob, uploadClinicalMedia } from "@/lib/client/clinicalMediaUpload";

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

function shouldPersistClinicalHistory(historyEntry: TrainingHistoryEntry) {
  return historyEntry.measurementQuality?.overall === "measured";
}

const CLINICAL_SYNC_PREFIX = "clinical-db-sync:";
const CLINICAL_MEDIA_SYNC_PREFIX = "clinical-media-sync:";

function getPersistKey(entry: TrainingHistoryEntry) {
  return `${CLINICAL_SYNC_PREFIX}${entry.historyId}`;
}

function getMediaPersistKey(entry: TrainingHistoryEntry) {
  return `${CLINICAL_MEDIA_SYNC_PREFIX}${entry.historyId}`;
}

function getTrainingType(entry: TrainingHistoryEntry) {
  return entry.trainingMode === "rehab" ? "speech-rehab" : "self-assessment";
}

function getClinicalSourceSessionKey(entry: TrainingHistoryEntry) {
  const trainingType = getTrainingType(entry);
  return `history-${trainingType}-${entry.historyId}`;
}

function sanitizeHistoryEntryForDatabase(
  historyEntry: TrainingHistoryEntry,
): TrainingHistoryEntry {
  const compactItems = (items: any[]) =>
    (Array.isArray(items) ? items : []).map((item) => ({
      ...item,
      audioUrl: undefined,
      userImage: undefined,
      cameraFrameImage: undefined,
      cameraFrameFrames: undefined,
      imageData: undefined,
    }));

  return {
    ...historyEntry,
    stepDetails: historyEntry.stepDetails
      ? {
          ...historyEntry.stepDetails,
          step1: compactItems(historyEntry.stepDetails.step1),
          step2: compactItems(historyEntry.stepDetails.step2),
          step3: compactItems(historyEntry.stepDetails.step3),
          step4: compactItems(historyEntry.stepDetails.step4),
          step5: compactItems(historyEntry.stepDetails.step5),
          step6: compactItems(historyEntry.stepDetails.step6),
        }
      : historyEntry.stepDetails,
    vnv: historyEntry.vnv,
  };
}

export async function syncTrainingMediaForHistory(
  patient: PatientProfile,
  historyEntry: TrainingHistoryEntry,
) {
  if (!shouldPersistClinicalHistory(historyEntry)) {
    return { synced: false, skipped: true as const };
  }
  if (typeof window !== "undefined") {
    const cached = window.sessionStorage.getItem(getMediaPersistKey(historyEntry));
    if (cached) {
      return JSON.parse(cached) as { synced: boolean };
    }
  }

  const uploads: Array<Promise<unknown>> = [];
  const trainingType = getTrainingType(historyEntry);
  const sourceSessionKey = getClinicalSourceSessionKey(historyEntry);

  const enqueueAudioUpload = (
    stepNo: number,
    captureRole: string,
    labelSegment: string,
    audioUrl: string,
    durationMs?: number | null,
  ) => {
    if (!audioUrl || !audioUrl.startsWith("data:audio")) return;
    uploads.push(
      dataUrlToBlob(audioUrl).then((blob) =>
        uploadClinicalMedia({
          patient,
          sourceSessionKey,
          trainingType,
          stepNo,
          mediaType: "audio",
          captureRole,
          labelSegment,
          blob,
          fileExtension: blob.type.includes("mpeg") ? "mp3" : "webm",
          durationMs: durationMs ?? null,
        }),
      ),
    );
  };

  const enqueueImageUpload = (
    stepNo: number,
    captureRole: string,
    labelSegment: string,
    imageUrl: string,
  ) => {
    if (!imageUrl || !imageUrl.startsWith("data:image")) return;
    uploads.push(
      dataUrlToBlob(imageUrl).then((blob) =>
        uploadClinicalMedia({
          patient,
          sourceSessionKey,
          trainingType,
          stepNo,
          mediaType: "image",
          captureRole,
          labelSegment,
          blob,
          fileExtension: blob.type.includes("png") ? "png" : "jpg",
        }),
      ),
    );
  };

  (historyEntry.stepDetails?.step2 ?? []).forEach((item: any) => {
    enqueueAudioUpload(2, "step2-audio", String(item?.text ?? "step2"), String(item?.audioUrl ?? ""), item?.responseTime ?? null);
  });

  (historyEntry.stepDetails?.step4 ?? []).forEach((item: any) => {
    enqueueAudioUpload(4, "step4-audio", String(item?.situation ?? item?.text ?? "step4"), String(item?.audioUrl ?? ""), item?.speechDuration ? Math.round(Number(item.speechDuration) * 1000) : null);
  });

  (historyEntry.stepDetails?.step5 ?? []).forEach((item: any) => {
    enqueueAudioUpload(5, "step5-audio", String(item?.text ?? "step5"), String(item?.audioUrl ?? ""), item?.totalTime ?? null);
  });

  (historyEntry.stepDetails?.step6 ?? []).forEach((item: any) => {
    enqueueImageUpload(6, "step6-image", String(item?.word ?? item?.text ?? "step6"), String(item?.userImage ?? ""));
  });

  await Promise.all(uploads);

  const normalized = { synced: true };
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(
      getMediaPersistKey(historyEntry),
      JSON.stringify(normalized),
    );
  }

  return normalized;
}

export async function persistTrainingHistoryToDatabase(
  patient: PatientProfile,
  historyEntry: TrainingHistoryEntry,
): Promise<PersistClinicalHistoryResult> {
  if (!shouldPersistClinicalHistory(historyEntry)) {
    return { skipped: true };
  }
  if (typeof window !== "undefined") {
    const cached = window.sessionStorage.getItem(getPersistKey(historyEntry));
    if (cached) {
      return JSON.parse(cached) as PersistClinicalHistoryResult;
    }
  }

  const sanitizedHistoryEntry = sanitizeHistoryEntryForDatabase(historyEntry);

  const response = await fetch("/api/clinical-results", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ patient, historyEntry: sanitizedHistoryEntry }),
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
