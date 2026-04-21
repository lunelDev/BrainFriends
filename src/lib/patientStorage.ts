// src/lib/patientStorage.ts
import { sessionStoreAdapter } from "@/lib/storage/adapters";
import type { PatientBootstrap } from "@/lib/security/patientRedaction";

export interface PatientProfile {
  sessionId: string;
  userRole?: "patient" | "admin" | "therapist";
  organizationId?: string | null;
  hasAssignedTherapist?: boolean;
  name: string;
  birthDate?: string;
  gender: "M" | "F" | "U";
  age: number;
  educationYears: number;
  onsetDate?: string;
  daysSinceOnset?: number;
  hemiplegia?: "Y" | "N";
  hemianopsia?: "NONE" | "RIGHT" | "LEFT";
  phone?: string;
  hand: "R" | "L" | "U";
  language?: string;
  createdAt: number;
  updatedAt: number;
}

declare global {
  interface Window {
    __BRAINFRIENDS_PATIENT__?: PatientBootstrap | null;
  }
}

function getBootstrappedPatientProfile(): PatientProfile | null {
  if (typeof window === "undefined") return null;
  const patient = window.__BRAINFRIENDS_PATIENT__;
  if (!patient?.patientId) return null;

  return {
    sessionId: patient.patientId,
    userRole:
      patient.role === "admin"
        ? "admin"
        : patient.role === "therapist"
          ? "therapist"
          : "patient",
    organizationId: null,
    hasAssignedTherapist: false,
    name: patient.displayName,
    gender: "U",
    age: 0,
    educationYears: 0,
    hand: "U",
    createdAt: 0,
    updatedAt: 0,
  };
}

function toBootstrapPatient(profile: PatientProfile): PatientBootstrap {
  return {
    patientId: profile.sessionId,
    role:
      profile.userRole === "admin"
        ? "admin"
        : profile.userRole === "therapist"
          ? "therapist"
          : "patient",
    displayName: profile.name,
  };
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
  } catch {
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

  return null;
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

  if (typeof window !== "undefined") {
    window.__BRAINFRIENDS_PATIENT__ = toBootstrapPatient(next);
  }

  return next;
}

export function replacePatientProfile(profile: PatientProfile): PatientProfile {
  sessionStoreAdapter.setItem("btt.sessionId", profile.sessionId);
  if (typeof window !== "undefined") {
    window.__BRAINFRIENDS_PATIENT__ = toBootstrapPatient(profile);
  }
  return profile;
}

export function clearAllStorage() {
  if (typeof window !== "undefined") {
    sessionStoreAdapter.removeItem("btt.sessionId");
    window.__BRAINFRIENDS_PATIENT__ = null;
  }
}
