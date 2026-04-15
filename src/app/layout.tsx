import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import {
  AUTH_COOKIE_NAME,
  getAuthenticatedSessionContext,
} from "@/lib/server/accountAuth";
import { listTrainingDraftsForAuthenticatedUser } from "@/lib/server/trainingDraftsDb";
import {
  filterManagedStorageDrafts,
  LOCAL_MANAGED_KEYS,
  LOCAL_MANAGED_PREFIXES,
  SESSION_MANAGED_KEYS,
  SESSION_MANAGED_PREFIXES,
} from "@/lib/storage/managedStorage";
import { redactPatientForClient } from "@/lib/security/patientRedaction";

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
  variable: "--font-noto-sans-kr",
});

export const metadata: Metadata = {
  title: "브레인프렌즈",
  description: "SaMD 기반 언어 재활 훈련",
};

function serializePatientBootstrap(patient: unknown) {
  return JSON.stringify(patient ?? null).replace(/</g, "\\u003c");
}

function serializeDraftBootstrap(drafts: unknown) {
  return JSON.stringify(drafts ?? { local: {}, session: {} }).replace(
    /</g,
    "\\u003c",
  );
}

function buildStorageBootstrapScript(patient: unknown, drafts: unknown) {
  const serializedPatient = serializePatientBootstrap(patient);
  const serializedDrafts = serializeDraftBootstrap(drafts);
  const serializedLocalKeys = JSON.stringify(LOCAL_MANAGED_KEYS);
  const serializedLocalPrefixes = JSON.stringify(LOCAL_MANAGED_PREFIXES);
  const serializedSessionKeys = JSON.stringify(SESSION_MANAGED_KEYS);
  const serializedSessionPrefixes = JSON.stringify(SESSION_MANAGED_PREFIXES);
  return `
    (() => {
      const patient = ${serializedPatient};
      const drafts = ${serializedDrafts};
      const localManagedKeys = new Set(${serializedLocalKeys});
      const localManagedPrefixes = ${serializedLocalPrefixes};
      const sessionManagedKeys = new Set(${serializedSessionKeys});
      const sessionManagedPrefixes = ${serializedSessionPrefixes};
      window.__BRAINFRIENDS_PATIENT__ = patient;
      window.__BRAINFRIENDS_DRAFTS__ = drafts;

      const isManagedKey = (scope, key) => {
        if (!key) return false;
        if (scope === "local") {
          return localManagedKeys.has(key) || localManagedPrefixes.some((prefix) => key.startsWith(prefix));
        }
        if (sessionManagedKeys.has(key)) {
          return true;
        }
        return sessionManagedPrefixes.some((prefix) => key.startsWith(prefix));
      };

      const hydrateStorage = (scope, storage, values) => {
        if (!storage) return;
        const existingKeys = [];
        for (let index = 0; index < storage.length; index += 1) {
          const key = storage.key(index);
          if (key) existingKeys.push(key);
        }
        for (const key of existingKeys) {
          if (isManagedKey(scope, key) && !(key in values)) {
            storage.removeItem(key);
          }
        }
        Object.entries(values || {}).forEach(([key, value]) => {
          if (typeof value === "string") {
            storage.setItem(key, value);
          }
        });
      };

      try {
        hydrateStorage("local", window.localStorage, drafts?.local || {});
        hydrateStorage("session", window.sessionStorage, drafts?.session || {});
      } catch {}

      if (window.__BRAINFRIENDS_STORAGE_SYNC__) {
        return;
      }
      window.__BRAINFRIENDS_STORAGE_SYNC__ = true;

      const rawSetItem = Storage.prototype.setItem;
      const rawRemoveItem = Storage.prototype.removeItem;
      const sync = (scope, key, value, method) => {
        if (!isManagedKey(scope, key)) return;
        const body =
          method === "PUT"
            ? JSON.stringify({ scope, key, value })
            : JSON.stringify({ scope, key });
        fetch("/api/client-storage-sync", {
          method,
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => undefined);
      };

      Storage.prototype.setItem = function(key, value) {
        rawSetItem.call(this, key, value);
        if (this === window.localStorage) {
          sync("local", String(key), String(value), "PUT");
          return;
        }
        if (this === window.sessionStorage) {
          sync("session", String(key), String(value), "PUT");
        }
      };

      Storage.prototype.removeItem = function(key) {
        rawRemoveItem.call(this, key);
        if (this === window.localStorage) {
          sync("local", String(key), "", "DELETE");
          return;
        }
        if (this === window.sessionStorage) {
          sync("session", String(key), "", "DELETE");
        }
      };
    })();
  `;
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const sessionContext = sessionToken
    ? await getAuthenticatedSessionContext(sessionToken).catch(() => null)
    : null;
  const sessionPatient = sessionContext?.patient ?? null;
  const clientPatient = redactPatientForClient(sessionPatient);
  const clientDrafts = filterManagedStorageDrafts(
    sessionToken
    ? await listTrainingDraftsForAuthenticatedUser(sessionToken).catch(() => ({
        local: {},
        session: {},
      }))
    : { local: {}, session: {} },
  );

  return (
    <html lang="ko" suppressHydrationWarning>
      <head />
      <body
        suppressHydrationWarning
        className={`${notoSansKr.variable} antialiased`}
      >
        <script
          dangerouslySetInnerHTML={{
            __html: buildStorageBootstrapScript(clientPatient, clientDrafts),
          }}
        />
        {children}
      </body>
    </html>
  );
}
