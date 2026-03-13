import { NextResponse } from "next/server";
import type { PatientProfile } from "@/lib/patientStorage";
import { buildPatientPseudonymId } from "@/lib/server/patientIdentityDb";
import {
  buildMediaObjectKey,
  createPutObjectSignedUrl,
  getObjectStorageBucketName,
} from "@/lib/server/ncpObjectStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  patient?: PatientProfile | null;
  sourceSessionKey?: string;
  trainingType?: string;
  stepNo?: number | null;
  mediaType?: "audio" | "image" | "video";
  captureRole?: string;
  mimeType?: string;
  fileExtension?: string;
  capturedAt?: string;
};

function isValidPatient(patient: PatientProfile | null | undefined): patient is PatientProfile {
  return Boolean(patient?.name?.trim() && patient?.gender && patient?.age);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as RequestBody;

  if (!isValidPatient(body.patient)) {
    return NextResponse.json({ ok: false, error: "invalid_patient_payload" }, { status: 400 });
  }

  if (!body.sourceSessionKey || !body.trainingType || !body.mediaType || !body.captureRole || !body.mimeType || !body.fileExtension) {
    return NextResponse.json({ ok: false, error: "invalid_media_init_payload" }, { status: 400 });
  }

  try {
    const patientPseudonymId = buildPatientPseudonymId(body.patient);
    const { mediaId, objectKey } = buildMediaObjectKey({
      patientPseudonymId,
      sourceSessionKey: body.sourceSessionKey,
      trainingType: body.trainingType,
      stepNo: body.stepNo ?? null,
      captureRole: body.captureRole,
      extension: body.fileExtension,
    });

    const uploadUrl = await createPutObjectSignedUrl({
      objectKey,
      contentType: body.mimeType,
    });

    return NextResponse.json({
      ok: true,
      mediaId,
      patientPseudonymId,
      bucketName: getObjectStorageBucketName(),
      objectKey,
      uploadUrl,
      capturedAt: body.capturedAt ?? new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "failed_to_init_media_upload" },
      { status: 500 },
    );
  }
}
