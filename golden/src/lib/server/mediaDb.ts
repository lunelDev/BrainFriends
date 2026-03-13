import type { PoolClient } from "pg";
import { getDbPool } from "@/lib/server/postgres";

export type ClinicalMediaRecord = {
  mediaId: string;
  patientPseudonymId: string;
  sourceSessionKey: string;
  trainingType: string;
  stepNo?: number | null;
  mediaType: "audio" | "image" | "video";
  captureRole: string;
  bucketName: string;
  objectKey: string;
  mimeType: string;
  fileSizeBytes?: number | null;
  durationMs?: number | null;
  sha256Hash?: string | null;
  capturedAt: string;
  status?: "active" | "deleted" | "quarantined";
};

async function insertMediaRecord(client: PoolClient, record: ClinicalMediaRecord) {
  await client.query(
    `
      INSERT INTO clinical_media_objects (
        media_id,
        patient_pseudonym_id,
        source_session_key,
        training_type,
        step_no,
        media_type,
        capture_role,
        bucket_name,
        object_key,
        mime_type,
        file_size_bytes,
        duration_ms,
        sha256_hash,
        captured_at,
        uploaded_at,
        status
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::timestamptz, NOW(), $15
      )
      ON CONFLICT (media_id) DO UPDATE
      SET
        file_size_bytes = EXCLUDED.file_size_bytes,
        duration_ms = EXCLUDED.duration_ms,
        sha256_hash = EXCLUDED.sha256_hash,
        status = EXCLUDED.status
    `,
    [
      record.mediaId,
      record.patientPseudonymId,
      record.sourceSessionKey,
      record.trainingType,
      record.stepNo ?? null,
      record.mediaType,
      record.captureRole,
      record.bucketName,
      record.objectKey,
      record.mimeType,
      record.fileSizeBytes ?? null,
      record.durationMs ?? null,
      record.sha256Hash ?? null,
      record.capturedAt,
      record.status ?? "active",
    ],
  );
}

export async function saveClinicalMediaRecord(record: ClinicalMediaRecord) {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await insertMediaRecord(client, record);
    await client.query("COMMIT");
    return record;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
