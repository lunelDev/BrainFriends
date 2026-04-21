import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

export type OrganizationRegistrationRequestStatus = "pending" | "approved" | "rejected";

type TwoFactorMethod = "otp" | "sms";
type IrbStatus = "not_applicable" | "planned" | "approved";

type OrganizationRegistrationRequestStore = {
  id: string;
  organizationName: string;
  businessNumber: string;
  representativeName: string;
  organizationType: string;
  openedDate?: string;
  businessLicenseFileName: string;
  businessLicenseFileDataUrl?: string;
  careInstitutionNumber: string;
  medicalInstitutionCode?: string;
  medicalDepartments?: string;
  bedCount?: number;
  organizationPhone: string;
  postalCode: string;
  roadAddress: string;
  addressDetail: string;
  contactName: string;
  contactTitle?: string;
  contactPhone: string;
  contactEmail: string;
  adminLoginEmail?: string;
  adminPasswordHash?: string;
  twoFactorMethod?: TwoFactorMethod;
  billingEmail?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  servicePurpose?: string;
  targetPatients?: string;
  doctorName?: string;
  doctorLicenseNumber?: string;
  irbStatus?: IrbStatus;
  termsAgreed: boolean;
  privacyAgreed: boolean;
  medicalDataAgreed: boolean;
  contractAgreed: boolean;
  patientDataAgreed: boolean;
  status: OrganizationRegistrationRequestStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
};

export type OrganizationRegistrationRequest = Omit<
  OrganizationRegistrationRequestStore,
  "businessLicenseFileDataUrl" | "adminPasswordHash"
>;

type RequestPayload = {
  organizationName: string;
  businessNumber: string;
  representativeName: string;
  organizationType: string;
  openedDate?: string;
  businessLicenseFileName: string;
  businessLicenseFileDataUrl?: string;
  careInstitutionNumber: string;
  medicalInstitutionCode?: string;
  medicalDepartments?: string;
  bedCount?: number;
  organizationPhone: string;
  postalCode: string;
  roadAddress: string;
  addressDetail: string;
  contactName: string;
  contactTitle?: string;
  contactPhone: string;
  contactEmail: string;
  adminLoginEmail?: string;
  adminPassword?: string;
  twoFactorMethod?: TwoFactorMethod;
  billingEmail?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
  servicePurpose?: string;
  targetPatients?: string;
  doctorName?: string;
  doctorLicenseNumber?: string;
  irbStatus?: IrbStatus;
  termsAgreed: boolean;
  privacyAgreed: boolean;
  medicalDataAgreed: boolean;
  contractAgreed: boolean;
  patientDataAgreed: boolean;
};

const DATA_DIR = path.join(process.cwd(), "data", "organizations");
const REQUESTS_PATH = path.join(DATA_DIR, "registration-requests.json");

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

function toPublicRequest(
  item: OrganizationRegistrationRequestStore,
): OrganizationRegistrationRequest {
  const { businessLicenseFileDataUrl, adminPasswordHash, ...rest } = item;
  void businessLicenseFileDataUrl;
  void adminPasswordHash;
  return rest;
}

async function readRequests(): Promise<OrganizationRegistrationRequestStore[]> {
  await ensureDir();
  try {
    const raw = await readFile(REQUESTS_PATH, "utf8");
    const parsed = JSON.parse(raw) as OrganizationRegistrationRequestStore[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeRequests(items: OrganizationRegistrationRequestStore[]) {
  await ensureDir();
  await writeFile(REQUESTS_PATH, JSON.stringify(items, null, 2), "utf8");
}

function normalizeBusinessNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 10)}`;
}

function normalizePhone(value: string) {
  return String(value ?? "").replace(/[^\d-]/g, "").trim();
}

function normalizeDate(value?: string) {
  const text = String(value ?? "").trim();
  if (!text) return undefined;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw new Error("invalid_request_payload");
  }
  return text;
}

function normalizeEmail(value: string) {
  return String(value ?? "").trim().toLowerCase();
}

function hashPassword(value?: string) {
  const text = String(value ?? "").trim();
  if (!text) return undefined;
  return crypto.createHash("sha256").update(text).digest("hex");
}

function requireTruthy(value: string | boolean | undefined | null) {
  return Boolean(value);
}

export async function listOrganizationRegistrationRequests() {
  const items = await readRequests();
  return items
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map(toPublicRequest);
}

export async function createOrganizationRegistrationRequest(
  payload: RequestPayload,
): Promise<OrganizationRegistrationRequest> {
  const next: OrganizationRegistrationRequestStore = {
    id: crypto.randomUUID(),
    organizationName: String(payload.organizationName ?? "").trim(),
    businessNumber: normalizeBusinessNumber(payload.businessNumber ?? ""),
    representativeName: String(payload.representativeName ?? "").trim(),
    organizationType: String(payload.organizationType ?? "").trim(),
    openedDate: normalizeDate(payload.openedDate),
    businessLicenseFileName: String(payload.businessLicenseFileName ?? "").trim(),
    businessLicenseFileDataUrl: String(payload.businessLicenseFileDataUrl ?? "").trim() || undefined,
    careInstitutionNumber: String(payload.careInstitutionNumber ?? "").trim(),
    medicalInstitutionCode: String(payload.medicalInstitutionCode ?? "").trim() || undefined,
    medicalDepartments: String(payload.medicalDepartments ?? "").trim() || undefined,
    bedCount:
      typeof payload.bedCount === "number" && Number.isFinite(payload.bedCount)
        ? payload.bedCount
        : undefined,
    organizationPhone: normalizePhone(payload.organizationPhone ?? ""),
    postalCode: String(payload.postalCode ?? "").trim(),
    roadAddress: String(payload.roadAddress ?? "").trim(),
    addressDetail: String(payload.addressDetail ?? "").trim(),
    contactName: String(payload.contactName ?? "").trim(),
    contactTitle: String(payload.contactTitle ?? "").trim() || undefined,
    contactPhone: normalizePhone(payload.contactPhone ?? ""),
    contactEmail: normalizeEmail(payload.contactEmail ?? ""),
    adminLoginEmail: normalizeEmail(payload.adminLoginEmail ?? "") || undefined,
    adminPasswordHash: hashPassword(payload.adminPassword),
    twoFactorMethod: payload.twoFactorMethod === "sms" ? "sms" : undefined,
    billingEmail: normalizeEmail(payload.billingEmail ?? "") || undefined,
    bankName: String(payload.bankName ?? "").trim() || undefined,
    bankAccountNumber: String(payload.bankAccountNumber ?? "").trim() || undefined,
    bankAccountHolder: String(payload.bankAccountHolder ?? "").trim() || undefined,
    servicePurpose: String(payload.servicePurpose ?? "").trim() || undefined,
    targetPatients: String(payload.targetPatients ?? "").trim() || undefined,
    doctorName: String(payload.doctorName ?? "").trim() || undefined,
    doctorLicenseNumber: String(payload.doctorLicenseNumber ?? "").trim() || undefined,
    irbStatus:
      payload.irbStatus === "planned" || payload.irbStatus === "approved"
        ? payload.irbStatus
        : undefined,
    termsAgreed: Boolean(payload.termsAgreed),
    privacyAgreed: Boolean(payload.privacyAgreed),
    medicalDataAgreed: Boolean(payload.medicalDataAgreed),
    contractAgreed: Boolean(payload.contractAgreed),
    patientDataAgreed: Boolean(payload.patientDataAgreed),
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  const requiredChecks = [
    requireTruthy(next.organizationName),
    requireTruthy(next.businessNumber),
    requireTruthy(next.representativeName),
    requireTruthy(next.organizationType),
    requireTruthy(next.businessLicenseFileName),
    requireTruthy(next.careInstitutionNumber),
    requireTruthy(next.contactName),
    requireTruthy(next.contactEmail),
    requireTruthy(next.contactPhone),
    next.termsAgreed,
    next.privacyAgreed,
    next.medicalDataAgreed,
  ];

  if (requiredChecks.some((item) => !item)) {
    throw new Error("invalid_request_payload");
  }

  const requests = await readRequests();
  const duplicate = requests.find(
    (item) =>
      item.organizationName === next.organizationName ||
      item.businessNumber === next.businessNumber ||
      item.careInstitutionNumber === next.careInstitutionNumber,
  );
  if (duplicate) {
    throw new Error("organization_already_exists");
  }

  requests.unshift(next);
  await writeRequests(requests);
  return toPublicRequest(next);
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

  const next: OrganizationRegistrationRequestStore = {
    ...current,
    status: input.status,
    reviewedAt: new Date().toISOString(),
    reviewedBy: String(input.reviewerLoginId ?? "").trim() || undefined,
  };

  requests[index] = next;
  await writeRequests(requests);
  return toPublicRequest(next);
}
