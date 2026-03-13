import { NextResponse } from "next/server";
import type { PatientProfile } from "@/lib/patientStorage";
import {
  buildPatientPseudonymId,
  ensurePatientIdentity,
} from "@/lib/server/patientIdentityDb";
import { assertObjectExists, getObjectStorageBucketName } from "@/lib/server/ncpObjectStorage";
import { saveClinicalMediaRecord } from "@/lib/server/mediaDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  patient?: PatientProfile | null;
  mediaId?: string;
  sourceSessionKey?: string;
  trainingType?: string;
  stepNo?: number | null;
  mediaType?: "audio" | "image" | "video";
  captureRole?: string;
  mimeType?: string;
  objectKey?: string;
  fileSizeBytes?: number | null;
  durationMs?: number | null;
  sha256Hash?: string | null;
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

  if (!body.mediaId || !body.sourceSessionKey || !body.trainingType || !body.mediaType || !body.captureRole || !body.mimeType || !body.objectKey) {
    return NextResponse.json({ ok: false, error: "invalid_media_complete_payload" }, { status: 400 });
  }

  try {
    await assertObjectExists(body.objectKey);
    await ensurePatientIdentity(body.patient);
    const patientPseudonymId = buildPatientPseudonymId(body.patient);

    const saved = await saveClinicalMediaRecord({
      mediaId: body.mediaId,
      patientPseudonymId,
      sourceSessionKey: body.sourceSessionKey,
      trainingType: body.trainingType,
      stepNo: body.stepNo ?? null,
      mediaType: body.mediaType,
      captureRole: body.captureRole,
      bucketName: getObjectStorageBucketName(),
      objectKey: body.objectKey,
      mimeType: body.mimeType,
      fileSizeBytes: body.fileSizeBytes ?? null,
      durationMs: body.durationMs ?? null,
      sha256Hash: body.sha256Hash ?? null,
      capturedAt: body.capturedAt ?? new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, saved });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "failed_to_complete_media_upload" },
      { status: 500 },
    );
  }
}
