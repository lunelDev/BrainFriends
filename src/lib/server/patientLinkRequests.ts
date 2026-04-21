import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type PatientLinkRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "ended";

export type PatientLinkRequest = {
  id: string;
  patientUserId: string;
  patientId: string;
  patientName?: string;
  organizationId: string;
  organizationName?: string;
  therapistUserId: string;
  therapistName?: string;
  status: PatientLinkRequestStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
};

type CreatePatientLinkRequestInput = Omit<
  PatientLinkRequest,
  "id" | "status" | "createdAt" | "updatedAt" | "reviewedAt" | "reviewedBy"
>;

const DATA_DIR = path.join(process.cwd(), "data", "patient-link");
const REQUESTS_PATH = path.join(DATA_DIR, "requests.json");

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readRequests(): Promise<PatientLinkRequest[]> {
  await ensureDir();
  try {
    const raw = await readFile(REQUESTS_PATH, "utf8");
    const parsed = JSON.parse(raw) as PatientLinkRequest[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeRequests(items: PatientLinkRequest[]) {
  await ensureDir();
  await writeFile(REQUESTS_PATH, JSON.stringify(items, null, 2), "utf8");
}

export async function listPatientLinkRequests() {
  const items = await readRequests();
  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function createOrReplacePatientLinkRequest(
  input: CreatePatientLinkRequestInput,
) {
  const nextRequest: PatientLinkRequest = {
    id: randomUUID(),
    patientUserId: String(input.patientUserId ?? "").trim(),
    patientId: String(input.patientId ?? "").trim(),
    patientName: String(input.patientName ?? "").trim() || undefined,
    organizationId: String(input.organizationId ?? "").trim(),
    organizationName: String(input.organizationName ?? "").trim() || undefined,
    therapistUserId: String(input.therapistUserId ?? "").trim(),
    therapistName: String(input.therapistName ?? "").trim() || undefined,
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (
    !nextRequest.patientUserId ||
    !nextRequest.patientId ||
    !nextRequest.organizationId ||
    !nextRequest.therapistUserId
  ) {
    throw new Error("invalid_patient_link_request");
  }

  const items = await readRequests();
  const filtered = items.filter(
    (item) =>
      !(
        item.patientUserId === nextRequest.patientUserId &&
        item.status === "pending"
      ),
  );
  filtered.unshift(nextRequest);
  await writeRequests(filtered);
  return nextRequest;
}

export async function reviewPatientLinkRequest(input: {
  requestId: string;
  status: "approved" | "rejected";
  reviewedBy: string;
}) {
  const requestId = String(input.requestId ?? "").trim();
  if (!requestId) {
    throw new Error("invalid_patient_link_request");
  }

  const items = await readRequests();
  const index = items.findIndex((item) => item.id === requestId);
  if (index < 0) {
    throw new Error("patient_link_request_not_found");
  }

  const updated: PatientLinkRequest = {
    ...items[index],
    status: input.status,
    updatedAt: new Date().toISOString(),
    reviewedAt: new Date().toISOString(),
    reviewedBy: String(input.reviewedBy ?? "").trim() || undefined,
  };

  items[index] = updated;
  await writeRequests(items);
  return updated;
}
