// src/hooks/useTrainingSession.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import type { PatientProfile } from "@/lib/patientStorage";
import { getOrCreateSessionId } from "@/lib/patientStorage";

export function useTrainingSession() {
  const fallbackSessionId = useMemo(() => getOrCreateSessionId(), []);
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "include",
        });
        const payload = await response.json().catch(() => null);
        if (!cancelled) {
          setPatient(response.ok && payload?.patient ? payload.patient : null);
        }
      } catch {
        if (!cancelled) {
          setPatient(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const sessionId = patient?.sessionId ?? fallbackSessionId;

  const hasPatient = !!patient?.name && !!patient?.age;

  // ✅ ageGroup을 계산해서 포함시킵니다.
  const ageGroup = useMemo(() => {
    if (!patient?.age) return "Standard";
    return Number(patient.age) >= 65 ? "Senior" : "Standard";
  }, [patient?.age]);

  return { sessionId, patient, hasPatient, ageGroup, isLoading };
}
