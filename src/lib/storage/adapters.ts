// src/lib/storage/adapters.ts
import { SecureBrowserStorage } from "@/lib/security/secureStorage";

export interface KeyValueStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): string[];
}

const getLocalStorage = () =>
  typeof window === "undefined" ? null : window.localStorage;
const getSessionStorage = () =>
  typeof window === "undefined" ? null : window.sessionStorage;

export const localStoreAdapter: KeyValueStorageAdapter =
  new SecureBrowserStorage(getLocalStorage, "local");
export const sessionStoreAdapter: KeyValueStorageAdapter =
  new SecureBrowserStorage(getSessionStorage, "session");
