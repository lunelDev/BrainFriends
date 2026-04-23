export type ClientStorageScope = "local" | "session";

const SAFE_LOCAL_KEYS = [
  "btt.trainingMode",
  "brain-sing-last-song",
  "ui.theme",
  "ui.lastPlace",
  "session.progress.currentStep",
  "session.progress.place",
  "kwab_training_exit_progress",
];

const SAFE_SESSION_KEYS = [
  "btt.sessionId",
  "btt.trialMode",
  "btt.firstDiagnosisFlow",
  "session.progress.currentStep",
  "session.progress.place",
  "session.temp.uiNotice",
  "brain-sing-result",
  "security.blockedWriteCount",
];

export const SAFE_LOCAL_STORAGE_KEYS = new Set(SAFE_LOCAL_KEYS);
export const SAFE_SESSION_STORAGE_KEYS = new Set(SAFE_SESSION_KEYS);

export const MANAGED_LOCAL_STORAGE_KEYS = [...SAFE_LOCAL_KEYS];
export const MANAGED_SESSION_STORAGE_KEYS = [...SAFE_SESSION_KEYS];

export const ALLOWED_LOCAL_STORAGE_PREFIXES = ["kwab_training_session:"];
export const ALLOWED_SESSION_STORAGE_PREFIXES = [
  "step3_protocol:",
  "step6_questions:",
  "step_review:",
];

export const MANAGED_LOCAL_STORAGE_PREFIXES = [
  "kwab_training_session:",
  "kwab_training_history:",
];
export const MANAGED_SESSION_STORAGE_PREFIXES = [
  "step3_protocol:",
  "step6_questions:",
  "step_review:",
];

export function isAllowedClientStorageKey(
  scope: ClientStorageScope,
  key: string,
) {
  if (!key) return false;
  if (scope === "local") {
    return (
      SAFE_LOCAL_STORAGE_KEYS.has(key) ||
      ALLOWED_LOCAL_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))
    );
  }

  return (
    SAFE_SESSION_STORAGE_KEYS.has(key) ||
    ALLOWED_SESSION_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))
  );
}

export function isManagedClientStorageKey(
  scope: ClientStorageScope,
  key: string,
) {
  if (!key) return false;

  if (scope === "local") {
    return (
      SAFE_LOCAL_STORAGE_KEYS.has(key) ||
      MANAGED_LOCAL_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))
    );
  }

  return (
    SAFE_SESSION_STORAGE_KEYS.has(key) ||
    MANAGED_SESSION_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))
  );
}
