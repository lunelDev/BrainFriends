import {
  isAllowedClientStorageKey,
  isManagedClientStorageKey,
  type ClientStorageScope,
} from "./storagePolicy";
import { appendSecurityAuditLog } from "./auditLogger";

export class SecureBrowserStorage {
  constructor(
    private readonly getStorage: () => Storage | null,
    private readonly scope: ClientStorageScope,
  ) {}

  private reportBlockedKey(key: string) {
    if (typeof window !== "undefined") {
      try {
        const current = Number(window.sessionStorage.getItem("security.blockedWriteCount") ?? "0");
        window.sessionStorage.setItem(
          "security.blockedWriteCount",
          String(Number.isFinite(current) ? current + 1 : 1),
        );
      } catch {
        // ignore browser storage counter failures
      }
    }
    void appendSecurityAuditLog({
      eventType: "CLIENT_STORAGE_BLOCKED",
      detail: `${this.scope}:${key}`,
      createdAt: new Date().toISOString(),
    }).catch(() => undefined);
  }

  getItem(key: string): string | null {
    if (!isManagedClientStorageKey(this.scope, key)) return null;
    return this.getStorage()?.getItem(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (!isAllowedClientStorageKey(this.scope, key)) {
      console.warn(`[SecureStorage] blocked key: ${key}`);
      this.reportBlockedKey(key);
      return;
    }
    this.getStorage()?.setItem(key, value);
  }

  removeItem(key: string): void {
    if (!isManagedClientStorageKey(this.scope, key)) return;
    this.getStorage()?.removeItem(key);
  }

  keys(): string[] {
    const storage = this.getStorage();
    if (!storage) return [];

    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && isManagedClientStorageKey(this.scope, key)) {
        keys.push(key);
      }
    }
    return keys;
  }
}
