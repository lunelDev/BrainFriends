import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type TherapistFollowUpState =
  | "none"
  | "monitor"
  | "follow_up"
  | "priority";

export type TherapistPatientNote = {
  patientId: string;
  memo: string;
  followUpState: TherapistFollowUpState;
  updatedAt: string;
  updatedBy: string;
};

const DATA_DIR = path.join(process.cwd(), "data", "therapist");
const NOTES_PATH = path.join(DATA_DIR, "patient-notes.json");

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readNotesStore() {
  await ensureDataDir();
  try {
    const raw = await readFile(NOTES_PATH, "utf8");
    const parsed = JSON.parse(raw) as Record<string, TherapistPatientNote>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code)
        : "";
    if (code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

async function writeNotesStore(store: Record<string, TherapistPatientNote>) {
  await ensureDataDir();
  await writeFile(NOTES_PATH, JSON.stringify(store, null, 2), "utf8");
}

export async function getTherapistPatientNote(patientId: string) {
  const store = await readNotesStore();
  return store[patientId] ?? null;
}

/**
 * 메모 store 의 모든 항목을 반환한다.
 * 권한/스코프 필터링은 호출 측 (therapistReportsDb.listTherapistPatientNotesScoped) 에서 한다.
 */
export async function listAllTherapistPatientNotes() {
  return readNotesStore();
}

export async function saveTherapistPatientNote(input: {
  patientId: string;
  memo: string;
  followUpState: TherapistFollowUpState;
  updatedBy: string;
}) {
  const store = await readNotesStore();
  const next: TherapistPatientNote = {
    patientId: input.patientId,
    memo: input.memo.trim(),
    followUpState: input.followUpState,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy,
  };
  store[input.patientId] = next;
  await writeNotesStore(store);
  return next;
}
