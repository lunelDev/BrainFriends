import type { TrainingHistoryEntry } from "@/lib/kwab/SessionManager";
import type {
  TherapistFollowUpState,
  TherapistPatientNote,
} from "@/lib/server/therapistNotes";

export type TherapistPatientSummary = {
  patientId: string;
  patientPseudonymId: string;
  patientName: string;
  patientCode: string;
  loginId: string | null;
  birthDate: string | null;
  latestActivityAt: string | null;
  selfAssessmentCount: number;
  rehabCount: number;
  singCount: number;
};

export type TherapistPatientDetail = {
  patientId: string;
  patientPseudonymId: string;
  patientName: string;
  patientCode: string;
  loginId: string | null;
  birthDate: string | null;
  phone: string | null;
};

type TherapistReportsListPayload = {
  ok: boolean;
  patients?: TherapistPatientSummary[];
  validationSampleEntries?: TrainingHistoryEntry[];
};

type TherapistReportDetailPayload = {
  ok: boolean;
  patient?: TherapistPatientDetail;
  entries?: TrainingHistoryEntry[];
};

type TherapistPatientNotePayload = {
  ok: boolean;
  note?: TherapistPatientNote | null;
};

export async function fetchTherapistReportsOverview() {
  const response = await fetch("/api/therapist/reports", {
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as
    | TherapistReportsListPayload
    | null;

  if (!response.ok || !payload?.ok) {
    throw new Error((payload as { error?: string } | null)?.error || "failed_to_load_therapist_reports");
  }

  return {
    patients: Array.isArray(payload.patients) ? payload.patients : [],
    validationSampleEntries: Array.isArray(payload.validationSampleEntries)
      ? payload.validationSampleEntries
      : [],
  };
}

export async function fetchTherapistPatientDetail(patientId: string) {
  const response = await fetch(
    `/api/therapist/reports?patientId=${encodeURIComponent(patientId)}`,
    {
      cache: "no-store",
    },
  );
  const payload = (await response.json().catch(() => null)) as
    | TherapistReportDetailPayload
    | null;

  if (!response.ok || !payload?.ok) {
    throw new Error((payload as { error?: string } | null)?.error || "failed_to_load_therapist_patient_detail");
  }

  return {
    patient: payload.patient ?? null,
    entries: Array.isArray(payload.entries) ? payload.entries : [],
  };
}

export async function fetchTherapistPatientNote(patientId: string) {
  const response = await fetch(
    `/api/therapist/reports/note?patientId=${encodeURIComponent(patientId)}`,
    {
      cache: "no-store",
    },
  );
  const payload = (await response.json().catch(() => null)) as
    | TherapistPatientNotePayload
    | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(
      (payload as { error?: string } | null)?.error ||
        "failed_to_load_therapist_note",
    );
  }

  return payload.note ?? null;
}

export async function saveTherapistPatientNote(input: {
  patientId: string;
  memo: string;
  followUpState: TherapistFollowUpState;
}) {
  const response = await fetch("/api/therapist/reports/note", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = (await response.json().catch(() => null)) as
    | TherapistPatientNotePayload
    | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(
      (payload as { error?: string } | null)?.error ||
        "failed_to_save_therapist_note",
    );
  }

  return payload.note ?? null;
}
