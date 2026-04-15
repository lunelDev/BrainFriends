const STEP_REVIEW_PREFIX = "step_review:";

function getKey(storageKey: string) {
  return `${STEP_REVIEW_PREFIX}${storageKey}`;
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [key, innerValue] of Object.entries(source)) {
      if (
        key === "imageData" ||
        key === "audioData" ||
        key === "cameraFrameImage" ||
        key === "cameraFrameFrames"
      ) {
        continue;
      }
      next[key] = sanitizeValue(innerValue);
    }
    return next;
  }

  return value;
}

export function loadTransientStepStorage<T = unknown>(storageKey: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(getKey(storageKey));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function saveTransientStepStorage(storageKey: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    const sanitized = sanitizeValue(value);
    window.sessionStorage.setItem(getKey(storageKey), JSON.stringify(sanitized));
  } catch {
    // best effort only
  }
}

export function removeTransientStepStorage(storageKey: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(getKey(storageKey));
  } catch {
    // ignore
  }
}
