import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

export type OrganizationRegistrationRequestStatus = "pending" | "approved" | "rejected";

export type OrganizationRegistrationRequest = {
  id: string;
  organizationName: string;
  businessNumber: string;
  representativeName: string;
  organizationPhone: string;
  address: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  status: OrganizationRegistrationRequestStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
};

type RequestPayload = {
  organizationName: string;
  businessNumber?: string;
  representativeName?: string;
  organizationPhone?: string;
  address: string;
  contactName: string;
  contactPhone?: string;
  contactEmail?: string;
};

const DATA_DIR = path.join(process.cwd(), "data", "organizations");
const REQUESTS_PATH = path.join(DATA_DIR, "registration-requests.json");

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readRequests(): Promise<OrganizationRegistrationRequest[]> {
  await ensureDir();
  try {
    const raw = await readFile(REQUESTS_PATH, "utf8");
    const parsed = JSON.parse(raw) as OrganizationRegistrationRequest[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeRequests(items: OrganizationRegistrationRequest[]) {
  await ensureDir();
  await writeFile(REQUESTS_PATH, JSON.stringify(items, null, 2), "utf8");
}

export async function listOrganizationRegistrationRequests() {
  const items = await readRequests();
  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function normalizeBusinessNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 10)}`;
}

export async function createOrganizationRegistrationRequest(
  payload: RequestPayload,
): Promise<OrganizationRegistrationRequest> {
  const organizationName = String(payload.organizationName ?? "").trim();
  const address = String(payload.address ?? "").trim();
  const contactName = String(payload.contactName ?? "").trim();

  if (!organizationName || !address || !contactName) {
    throw new Error("invalid_request_payload");
  }

  const requests = await readRequests();
  const request: OrganizationRegistrationRequest = {
    id: crypto.randomUUID(),
    organizationName,
    businessNumber: normalizeBusinessNumber(String(payload.businessNumber ?? "")),
    representativeName: String(payload.representativeName ?? "").trim(),
    organizationPhone: String(payload.organizationPhone ?? "").trim(),
    address,
    contactName,
    contactPhone: String(payload.contactPhone ?? "").trim(),
    contactEmail: String(payload.contactEmail ?? "").trim(),
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  requests.unshift(request);
  await writeRequests(requests);
  return request;
}

export async function reviewOrganizationRegistrationRequest(input: {
  requestId: string;
  status: Exclude<OrganizationRegistrationRequestStatus, "pending">;
  reviewerLoginId?: string;
}) {
  const requests = await readRequests();
  const index = requests.findIndex((item) => item.id === input.requestId);
  if (index < 0) {
    throw new Error("request_not_found");
  }

  const current = requests[index];
  if (current.status !== "pending") {
    throw new Error("request_already_reviewed");
  }

  const next: OrganizationRegistrationRequest = {
    ...current,
    status: input.status,
    reviewedAt: new Date().toISOString(),
    reviewedBy: String(input.reviewerLoginId ?? "").trim() || undefined,
  };

  requests[index] = next;
  await writeRequests(requests);
  return next;
}
