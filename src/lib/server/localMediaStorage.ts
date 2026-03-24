import { mkdir, readFile, writeFile, access } from "fs/promises";
import path from "path";

const LOCAL_MEDIA_BUCKET = "local-dev";
const LOCAL_MEDIA_PREFIX = "local-dev-media";
const LOCAL_MEDIA_ROOT = path.join(process.cwd(), "data", "local-media");

function normalizeKeySegment(value: string) {
  return value.replace(/\\/g, "/").replace(/^\/+/, "");
}

export function isLocalMediaMode() {
  return process.env.NODE_ENV !== "production";
}

export function getLocalMediaBucketName() {
  return LOCAL_MEDIA_BUCKET;
}

export function buildLocalMediaObjectKey(objectKey: string) {
  return `${LOCAL_MEDIA_PREFIX}/${normalizeKeySegment(objectKey)}`;
}

function resolveLocalMediaPath(objectKey: string) {
  const normalized = normalizeKeySegment(objectKey);
  if (!normalized.startsWith(`${LOCAL_MEDIA_PREFIX}/`)) {
    throw new Error("invalid_local_media_object_key");
  }
  const relativePath = normalized.slice(`${LOCAL_MEDIA_PREFIX}/`.length);
  return path.join(LOCAL_MEDIA_ROOT, relativePath);
}

export async function putLocalMediaObject(params: {
  objectKey: string;
  body: Buffer | Uint8Array | string;
}) {
  const filePath = resolveLocalMediaPath(params.objectKey);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, params.body);
}

export async function assertLocalMediaObjectExists(objectKey: string) {
  await access(resolveLocalMediaPath(objectKey));
}

export async function readLocalMediaObject(objectKey: string) {
  return readFile(resolveLocalMediaPath(objectKey));
}
