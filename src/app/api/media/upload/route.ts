import { createHash } from "crypto";
import { NextResponse } from "next/server";
import type { PatientProfile } from "@/lib/patientStorage";
import {
  buildMediaObjectKey,
  getObjectStorageBucketName,
  putObject,
} from "@/lib/server/ncpObjectStorage";
import {
  buildLocalMediaObjectKey,
  getLocalMediaBucketName,
  isLocalMediaMode,
  putLocalMediaObject,
} from "@/lib/server/localMediaStorage";
import {
  buildPatientPseudonymId,
  ensurePatientIdentity,
} from "@/lib/server/patientIdentityDb";
import { saveClinicalMediaRecord } from "@/lib/server/mediaDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidPatient(patient: PatientProfile | null | undefined): patient is PatientProfile {
  return Boolean(patient?.name?.trim() && patient?.gender && patient?.age);
}

function sha256Hex(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const patientRaw = formData.get("patient");
    const sourceSessionKey = formData.get("sourceSessionKey");
    const trainingType = formData.get("trainingType");
    const stepNoRaw = formData.get("stepNo");
    const mediaType = formData.get("mediaType");
    const captureRole = formData.get("captureRole");
    const labelSegment = formData.get("labelSegment");
    const fileExtension = formData.get("fileExtension");
    const durationMsRaw = formData.get("durationMs");
    const capturedAtRaw = formData.get("capturedAt");
    const file = formData.get("file");

    const patient = typeof patientRaw === "string"
      ? (JSON.parse(patientRaw) as PatientProfile)
      : null;

    if (!isValidPatient(patient)) {
      return NextResponse.json({ ok: false, error: "invalid_patient_payload" }, { status: 400 });
    }

    if (
      typeof sourceSessionKey !== "string" ||
      typeof trainingType !== "string" ||
      typeof mediaType !== "string" ||
      typeof captureRole !== "string" ||
      typeof fileExtension !== "string" ||
      !(file instanceof File)
    ) {
      return NextResponse.json({ ok: false, error: "invalid_media_upload_payload" }, { status: 400 });
    }

    await ensurePatientIdentity(patient);

    const patientPseudonymId = buildPatientPseudonymId(patient);
    const { mediaId, objectKey: remoteObjectKey } = buildMediaObjectKey({
      patientPseudonymId,
      sourceSessionKey,
      trainingType,
      stepNo: typeof stepNoRaw === "string" && stepNoRaw.length > 0 ? Number(stepNoRaw) : null,
      captureRole,
      labelSegment: typeof labelSegment === "string" ? labelSegment : null,
      capturedAt:
        typeof capturedAtRaw === "string" && capturedAtRaw.length > 0
          ? capturedAtRaw
          : null,
      extension: fileExtension,
    });
    const localMode = isLocalMediaMode();
    const objectKey = localMode
      ? buildLocalMediaObjectKey(remoteObjectKey)
      : remoteObjectKey;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type || "application/octet-stream";
    const capturedAt =
      typeof capturedAtRaw === "string" && capturedAtRaw.length > 0
        ? capturedAtRaw
        : new Date().toISOString();
    const durationMs =
      typeof durationMsRaw === "string" && durationMsRaw.length > 0
        ? Number(durationMsRaw)
        : null;

    if (localMode) {
      await putLocalMediaObject({
        objectKey,
        body: buffer,
      });
    } else {
      await putObject({
        objectKey,
        body: buffer,
        contentType: mimeType,
      });
    }

    const saved = await saveClinicalMediaRecord({
      mediaId,
      patientPseudonymId,
      sourceSessionKey,
      trainingType,
      stepNo: typeof stepNoRaw === "string" && stepNoRaw.length > 0 ? Number(stepNoRaw) : null,
      mediaType: mediaType as "audio" | "image" | "video",
      captureRole,
      bucketName: localMode
        ? getLocalMediaBucketName()
        : getObjectStorageBucketName(),
      objectKey,
      mimeType,
      fileSizeBytes: buffer.byteLength,
      durationMs,
      sha256Hash: sha256Hex(buffer),
      capturedAt,
    });

    return NextResponse.json({
      ok: true,
      mediaId: saved.mediaId,
      objectKey: saved.objectKey,
      bucketName: saved.bucketName,
      patientPseudonymId,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "failed_to_upload_media_via_server" },
      { status: 500 },
    );
  }
}
