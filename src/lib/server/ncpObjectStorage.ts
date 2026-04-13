import { randomUUID } from "crypto";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const bucketName = process.env.NCP_OBJECT_STORAGE_BUCKET;
const endpoint = process.env.NCP_OBJECT_STORAGE_ENDPOINT;
const region = process.env.NCP_OBJECT_STORAGE_REGION || "kr-standard";
const accessKeyId = process.env.NCP_ACCESS_KEY;
const secretAccessKey = process.env.NCP_SECRET_KEY;
const forcePathStyle = process.env.NCP_OBJECT_STORAGE_FORCE_PATH_STYLE !== "false";

function ensureStorageConfig() {
  if (!bucketName || !endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("missing_object_storage_config");
  }
}

let cachedClient: S3Client | null = null;

export function getObjectStorageClient() {
  ensureStorageConfig();

  const resolvedEndpoint = endpoint as string;
  const resolvedAccessKey = accessKeyId as string;
  const resolvedSecretKey = secretAccessKey as string;

  if (!cachedClient) {
    cachedClient = new S3Client({
      region,
      endpoint: resolvedEndpoint,
      forcePathStyle,
      credentials: {
        accessKeyId: resolvedAccessKey,
        secretAccessKey: resolvedSecretKey,
      },
    });
  }

  return cachedClient;
}

export function getObjectStorageBucketName() {
  ensureStorageConfig();
  return bucketName as string;
}

export function buildMediaObjectKey(params: {
  patientPseudonymId: string;
  sourceSessionKey: string;
  trainingType: string;
  stepNo?: number | null;
  captureRole: string;
  labelSegment?: string | null;
  capturedAt?: string | null;
  extension: string;
}) {
  const {
    patientPseudonymId,
    sourceSessionKey,
    trainingType,
    stepNo,
    captureRole,
    labelSegment,
    capturedAt,
    extension,
  } = params;
  const mediaId = randomUUID();
  const normalizedTraining = trainingType.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const normalizedCaptureRole = captureRole.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const hasStepNo = typeof stepNo === "number" && Number.isFinite(stepNo);
  const stepSegment = hasStepNo ? `step${stepNo}` : normalizedTraining;
  const sanitizedSessionKey = sourceSessionKey.replace(/[^a-zA-Z0-9_-]/g, "-");
  const normalizedLabelSegment =
    typeof labelSegment === "string" && labelSegment.trim().length > 0
      ? labelSegment
          .replace(/[^a-z0-9-]/gi, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
          .toLowerCase()
      : null;
  const captureDate = capturedAt ? new Date(capturedAt) : new Date();
  const hasValidCaptureDate = Number.isFinite(captureDate.getTime());
  const yyyy = hasValidCaptureDate
    ? String(captureDate.getFullYear())
    : "unknown-date";
  const mm = hasValidCaptureDate
    ? String(captureDate.getMonth() + 1).padStart(2, "0")
    : "00";
  const dd = hasValidCaptureDate
    ? String(captureDate.getDate()).padStart(2, "0")
    : "00";
  const hhmmss = hasValidCaptureDate
    ? `${String(captureDate.getHours()).padStart(2, "0")}${String(
        captureDate.getMinutes(),
      ).padStart(2, "0")}${String(captureDate.getSeconds()).padStart(2, "0")}`
    : "000000";
  return {
    mediaId,
    objectKey: `patients/${patientPseudonymId}/sessions/${sanitizedSessionKey}/${stepSegment}/${yyyy}/${mm}/${dd}/${hhmmss}/${normalizedCaptureRole}${normalizedLabelSegment ? `/${normalizedLabelSegment}` : ""}/${mediaId}.${extension}`,
  };
}

export async function createPutObjectSignedUrl(params: {
  objectKey: string;
  contentType: string;
  expiresInSec?: number;
}) {
  const client = getObjectStorageClient();
  const command = new PutObjectCommand({
    Bucket: getObjectStorageBucketName(),
    Key: params.objectKey,
    ContentType: params.contentType,
  });

  return getSignedUrl(client, command, {
    expiresIn: params.expiresInSec ?? 300,
  });
}

export async function putObject(params: {
  objectKey: string;
  body: Buffer | Uint8Array | string;
  contentType: string;
}) {
  const client = getObjectStorageClient();
  await client.send(
    new PutObjectCommand({
      Bucket: getObjectStorageBucketName(),
      Key: params.objectKey,
      ContentType: params.contentType,
      Body: params.body,
    }),
  );
}

export async function createGetObjectSignedUrl(params: {
  objectKey: string;
  expiresInSec?: number;
}) {
  const client = getObjectStorageClient();
  const command = new GetObjectCommand({
    Bucket: getObjectStorageBucketName(),
    Key: params.objectKey,
  });

  return getSignedUrl(client, command, {
    expiresIn: params.expiresInSec ?? 300,
  });
}

export async function assertObjectExists(objectKey: string) {
  const client = getObjectStorageClient();
  await client.send(
    new HeadObjectCommand({
      Bucket: getObjectStorageBucketName(),
      Key: objectKey,
    }),
  );
}

export async function readObject(objectKey: string) {
  const client = getObjectStorageClient();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: getObjectStorageBucketName(),
      Key: objectKey,
    }),
  );

  const body = response.Body;
  if (!body) {
    throw new Error("object_body_not_found");
  }

  if (typeof (body as any).transformToByteArray === "function") {
    return Buffer.from(await (body as any).transformToByteArray());
  }

  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array | Buffer | string>) {
    if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk));
      continue;
    }
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

