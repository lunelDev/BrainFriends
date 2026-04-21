import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

type StoredPatientTherapistAssignment = {
  patientId: string;
  therapistUserId: string;
  organizationId?: string;
  isActive: boolean;
  assignedAt: string;
  updatedAt: string;
};

const DATA_DIR = path.join(process.cwd(), "data", "patient-links");
const ASSIGNMENTS_PATH = path.join(DATA_DIR, "therapist-assignments.json");

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readAssignments(): Promise<StoredPatientTherapistAssignment[]> {
  await ensureDir();
  try {
    const raw = await readFile(ASSIGNMENTS_PATH, "utf8");
    const parsed = JSON.parse(raw) as StoredPatientTherapistAssignment[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAssignments(items: StoredPatientTherapistAssignment[]) {
  await ensureDir();
  await writeFile(ASSIGNMENTS_PATH, JSON.stringify(items, null, 2), "utf8");
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

export async function upsertFallbackPatientTherapistAssignment(input: {
  patientId: string;
  therapistUserId: string;
  organizationId?: string | null;
}) {
  const patientId = normalizeText(input.patientId);
  const therapistUserId = normalizeText(input.therapistUserId);
  const organizationId = normalizeText(input.organizationId) || undefined;

  if (!patientId || !therapistUserId) {
    throw new Error("invalid_patient_assignment");
  }

  const items = await readAssignments();
  const now = new Date().toISOString();
  const existingIndex = items.findIndex((item) => item.patientId === patientId);

  const next: StoredPatientTherapistAssignment = {
    patientId,
    therapistUserId,
    organizationId,
    isActive: true,
    assignedAt: existingIndex >= 0 ? items[existingIndex].assignedAt : now,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    items[existingIndex] = next;
  } else {
    items.unshift(next);
  }

  await writeAssignments(items);
  return next;
}

export async function hasFallbackPatientTherapistAssignment(patientId: string) {
  const normalizedPatientId = normalizeText(patientId);
  if (!normalizedPatientId) return false;
  const items = await readAssignments();
  return items.some(
    (item) => item.patientId === normalizedPatientId && item.isActive !== false,
  );
}
