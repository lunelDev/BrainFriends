"use client";

type ResumeMeta = {
  signature: string;
  updatedAt: number;
  count: number;
};

function safeJsonParse(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function hashString(input: string) {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

export function buildStepSignature(
  stepId: string,
  place: string,
  questionTokens: string[],
) {
  const normalized = questionTokens.map((token) => String(token ?? "")).join("||");
  return `${stepId}:${place}:${hashString(normalized)}`;
}

function getMetaKey(storageKey: string) {
  return `${storageKey}__meta`;
}

export function saveResumeMeta(
  storageKey: string,
  signature: string,
  count: number,
) {
  if (typeof window === "undefined") return;
  const payload: ResumeMeta = {
    signature,
    updatedAt: Date.now(),
    count: Number.isFinite(count) ? Math.max(0, count) : 0,
  };
  window.sessionStorage.setItem(getMetaKey(storageKey), JSON.stringify(payload));
}

export function isResumeMetaMatched(storageKey: string, signature: string) {
  if (typeof window === "undefined") return false;
  const parsed = safeJsonParse(
    window.sessionStorage.getItem(getMetaKey(storageKey)),
  );
  return Boolean(
    parsed &&
      typeof parsed.signature === "string" &&
      parsed.signature === signature,
  );
}

export function clearResumeMeta(storageKey: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(getMetaKey(storageKey));
}
