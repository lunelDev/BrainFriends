// src/lib/patientStorage.ts
import { sessionStoreAdapter } from "@/lib/storage/adapters";

export interface PatientProfile {
  sessionId: string;
  userRole?: "patient" | "admin";
  name: string;
  birthDate?: string; // YYYY-MM-DD
  gender: "M" | "F" | "U";
  age: number;
  educationYears: number; // ✅ 추가: 0 (무학), 1-6 (초등), 7+ (중등 이상)
  onsetDate?: string; // YYYY-MM-DD
  daysSinceOnset?: number; // 발병 후 경과일
  hemiplegia?: "Y" | "N";
  hemianopsia?: "NONE" | "RIGHT" | "LEFT";
  phone?: string;
  hand: "R" | "L" | "U";
  language?: string;
  createdAt: number;
  updatedAt: number;
}

const KEY = "btt.patient_profile";

declare global {
  interface Window {
    __BRAINFRIENDS_PATIENT__?: PatientProfile | null;
  }
}

function getBootstrappedPatientProfile(): PatientProfile | null {
  if (typeof window === "undefined") return null;
  const patient = window.__BRAINFRIENDS_PATIENT__;
  if (!patient) return null;
  return {
    ...patient,
    birthDate: patient.birthDate ?? "",
    educationYears: patient.educationYears ?? 0,
    onsetDate: patient.onsetDate ?? "",
    daysSinceOnset: patient.daysSinceOnset ?? undefined,
    hemiplegia: patient.hemiplegia ?? "N",
    hemianopsia: patient.hemianopsia ?? "NONE",
  } as PatientProfile;
}

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "server";
  const bootstrapped = getBootstrappedPatientProfile();
  if (bootstrapped?.sessionId) return bootstrapped.sessionId;
  const existing = sessionStoreAdapter.getItem("btt.sessionId");
  if (existing) return existing;

  let sid: string;
  try {
    sid = window.crypto.randomUUID();
  } catch (e) {
    sid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  sessionStoreAdapter.setItem("btt.sessionId", sid);
  return sid;
}

export function loadPatientProfile(): PatientProfile | null {
  if (typeof window === "undefined") return null;
  const bootstrapped = getBootstrappedPatientProfile();
  if (bootstrapped) {
    sessionStoreAdapter.setItem("btt.sessionId", bootstrapped.sessionId);
    return bootstrapped;
  }
  const raw = sessionStoreAdapter.getItem(KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      ...parsed,
      birthDate: parsed.birthDate ?? "",
      educationYears: parsed.educationYears ?? 0, // ✅ 안전장치: 값이 없으면 0 반환
      onsetDate: parsed.onsetDate ?? "",
      daysSinceOnset: parsed.daysSinceOnset ?? undefined,
      hemiplegia: parsed.hemiplegia ?? "N",
      hemianopsia: parsed.hemianopsia ?? "NONE",
    } as PatientProfile;
  } catch {
    return null;
  }
}

export function savePatientProfile(
  input: Omit<PatientProfile, "sessionId" | "createdAt" | "updatedAt">,
): PatientProfile {
  const sessionId = getOrCreateSessionId();
  const now = Date.now();
  const prev = loadPatientProfile();

  const next: PatientProfile = {
    ...input,
    sessionId,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  };

  sessionStoreAdapter.setItem(KEY, JSON.stringify(next));
  if (typeof window !== "undefined") {
    window.__BRAINFRIENDS_PATIENT__ = next;
  }
  return next;
}

export function replacePatientProfile(profile: PatientProfile): PatientProfile {
  sessionStoreAdapter.setItem(KEY, JSON.stringify(profile));
  sessionStoreAdapter.setItem("btt.sessionId", profile.sessionId);
  if (typeof window !== "undefined") {
    window.__BRAINFRIENDS_PATIENT__ = profile;
  }
  return profile;
}

export function clearAllStorage() {
  if (typeof window !== "undefined") {
    sessionStoreAdapter.removeItem(KEY);
    sessionStoreAdapter.removeItem("btt.sessionId");
    window.__BRAINFRIENDS_PATIENT__ = null;
  }
}
