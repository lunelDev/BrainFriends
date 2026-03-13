import type { PatientProfile } from "@/lib/patientStorage";

export type UploadClinicalMediaParams = {
  patient: PatientProfile;
  sourceSessionKey: string;
  trainingType: string;
  stepNo?: number | null;
  mediaType: "audio" | "image" | "video";
  captureRole: string;
  labelSegment?: string | null;
  blob: Blob;
  fileExtension: string;
  durationMs?: number | null;
  capturedAt?: string;
};

export async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl);
  return response.blob();
}

export async function uploadClinicalMedia(params: UploadClinicalMediaParams) {
  const {
    patient,
    sourceSessionKey,
    trainingType,
    stepNo,
    mediaType,
    captureRole,
    labelSegment,
    blob,
    fileExtension,
    durationMs,
    capturedAt = new Date().toISOString(),
  } = params;

  const formData = new FormData();
  formData.append("patient", JSON.stringify(patient));
  formData.append("sourceSessionKey", sourceSessionKey);
  formData.append("trainingType", trainingType);
  formData.append("stepNo", stepNo == null ? "" : String(stepNo));
  formData.append("mediaType", mediaType);
  formData.append("captureRole", captureRole);
  formData.append("labelSegment", labelSegment ?? "");
  formData.append("fileExtension", fileExtension);
  formData.append("durationMs", durationMs == null ? "" : String(durationMs));
  formData.append("capturedAt", capturedAt);
  formData.append("file", blob, `upload.${fileExtension}`);

  let response: Response;
  try {
    response = await fetch("/api/media/upload", {
      method: "POST",
      body: formData,
    });
  } catch (error) {
    throw new Error(
      `server_upload_failed:${
        error instanceof Error ? error.message : "failed_to_upload_media_via_server"
      }`,
    );
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || "failed_to_upload_media_via_server");
  }

  return {
    mediaId: payload.mediaId as string,
    objectKey: payload.objectKey as string,
    bucketName: payload.bucketName as string,
    patientPseudonymId: payload.patientPseudonymId as string,
  };
}
