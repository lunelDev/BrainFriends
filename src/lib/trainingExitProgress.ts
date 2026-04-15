"use client";

const EXIT_PROGRESS_KEY = "kwab_training_exit_progress";

type ExitProgressByPlace = Record<
  string,
  {
    currentStep: number;
    completedThroughStep: number;
    updatedAt: number;
  }
>;

function readExitProgressMap(storage: Storage | null): ExitProgressByPlace {
  if (!storage) return {};

  try {
    const raw = storage.getItem(EXIT_PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as ExitProgressByPlace;
    }
  } catch {
    // ignore broken or missing storage state
  }

  return {};
}

function getPreferredStorage() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

function getLegacyStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function getExitProgressMap() {
  const preferred = getPreferredStorage();
  const current = readExitProgressMap(preferred);
  if (Object.keys(current).length > 0) {
    return current;
  }

  const legacy = getLegacyStorage();
  const legacyValue = readExitProgressMap(legacy);
  if (Object.keys(legacyValue).length > 0 && preferred) {
    try {
      preferred.setItem(EXIT_PROGRESS_KEY, JSON.stringify(legacyValue));
      legacy?.removeItem(EXIT_PROGRESS_KEY);
    } catch {
      // ignore migration failures
    }
  }

  return legacyValue;
}

export function saveTrainingExitProgress(place: string, currentStep: number) {
  if (typeof window === "undefined") return;

  const safeStep = Number.isFinite(currentStep)
    ? Math.max(1, Math.floor(currentStep))
    : 1;

  const storage = getPreferredStorage();
  if (!storage) return;

  const existing = getExitProgressMap();

  existing[place] = {
    currentStep: safeStep,
    completedThroughStep: Math.max(0, safeStep - 1),
    updatedAt: Date.now(),
  };

  storage.setItem(EXIT_PROGRESS_KEY, JSON.stringify(existing));

  try {
    getLegacyStorage()?.removeItem(EXIT_PROGRESS_KEY);
  } catch {
    // no-op
  }
}

export function getTrainingExitProgress(place: string): {
  currentStep: number;
  completedThroughStep: number;
  updatedAt: number;
} | null {
  if (typeof window === "undefined") return null;

  try {
    const progress = getExitProgressMap()?.[place];
    if (!progress) return null;
    return progress;
  } catch {
    return null;
  }
}

export function clearTrainingExitProgress(place: string) {
  if (typeof window === "undefined") return;

  try {
    const storage = getPreferredStorage();
    if (!storage) return;

    const parsed = getExitProgressMap();
    if (!parsed || typeof parsed !== "object") return;

    delete parsed[place];
    storage.setItem(EXIT_PROGRESS_KEY, JSON.stringify(parsed));
    getLegacyStorage()?.removeItem(EXIT_PROGRESS_KEY);
  } catch {
    // no-op
  }
}
