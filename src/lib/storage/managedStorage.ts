import {
  isManagedClientStorageKey,
  MANAGED_LOCAL_STORAGE_KEYS,
  MANAGED_LOCAL_STORAGE_PREFIXES,
  MANAGED_SESSION_STORAGE_KEYS,
  MANAGED_SESSION_STORAGE_PREFIXES,
  type ClientStorageScope,
} from "@/lib/security/storagePolicy";

export type ManagedStorageScope = ClientStorageScope;

export const LOCAL_MANAGED_KEYS = MANAGED_LOCAL_STORAGE_KEYS;
export const SESSION_MANAGED_KEYS = MANAGED_SESSION_STORAGE_KEYS;
export const LOCAL_MANAGED_PREFIXES = MANAGED_LOCAL_STORAGE_PREFIXES;
export const SESSION_MANAGED_PREFIXES = MANAGED_SESSION_STORAGE_PREFIXES;

export function isManagedStorageKey(
  scope: ManagedStorageScope,
  key: string,
) {
  return isManagedClientStorageKey(scope, key);
}

export function filterManagedStorageDrafts(
  drafts:
    | Partial<Record<ManagedStorageScope, Record<string, string>>>
    | null
    | undefined,
): Record<ManagedStorageScope, Record<string, string>> {
  const sanitized = {
    local: {} as Record<string, string>,
    session: {} as Record<string, string>,
  };

  for (const scope of ["local", "session"] as const) {
    const entries = Object.entries(drafts?.[scope] ?? {});
    for (const [key, value] of entries) {
      if (typeof value !== "string") continue;
      if (!isManagedStorageKey(scope, key)) continue;
      sanitized[scope][key] = value;
    }
  }

  return sanitized;
}
