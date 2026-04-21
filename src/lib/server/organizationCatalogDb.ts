import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  ORGANIZATION_CATALOG,
  type OrganizationCatalogEntry,
} from "@/lib/organizations/catalog";
import { listOrganizationRegistrationRequests } from "@/lib/server/organizationRegistrationRequests";

export type ManagedOrganizationEntry = OrganizationCatalogEntry & {
  businessNumber?: string;
  representativeName?: string;
  organizationPhone?: string;
  organizationType?: string;
  careInstitutionNumber?: string;
  medicalInstitutionCode?: string;
  medicalDepartments?: string;
  postalCode?: string;
  roadAddress?: string;
  addressDetail?: string;
  contactName?: string;
  contactTitle?: string;
  contactPhone?: string;
  contactEmail?: string;
  adminLoginEmail?: string;
  twoFactorMethod?: "otp" | "sms";
  servicePurpose?: string;
  targetPatients?: string;
  doctorName?: string;
  doctorLicenseNumber?: string;
  createdAt?: string;
  source?: "builtin" | "manual";
};

const DATA_DIR = path.join(process.cwd(), "data", "organizations");
const ORGANIZATIONS_PATH = path.join(DATA_DIR, "manual-organizations.json");

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readManualOrganizations() {
  await ensureDataDir();
  try {
    const raw = await readFile(ORGANIZATIONS_PATH, "utf8");
    const parsed = JSON.parse(raw) as ManagedOrganizationEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code)
        : "";
    if (code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeManualOrganizations(store: ManagedOrganizationEntry[]) {
  await ensureDataDir();
  await writeFile(ORGANIZATIONS_PATH, JSON.stringify(store, null, 2), "utf8");
}

export async function listAvailableOrganizations() {
  const manual = await readManualOrganizations();
  return [
    ...ORGANIZATION_CATALOG.map((item) => ({
      ...item,
      source: "builtin" as const,
    })),
    ...manual.map((item) => ({
      ...item,
      source: "manual" as const,
    })),
  ];
}

export async function getAvailableOrganizationById(organizationId: string) {
  const items = await listAvailableOrganizations();
  return items.find((item) => item.id === organizationId) ?? null;
}

export type OrganizationDuplicateMatch = {
  /** 중복이 발견된 저장소. manual = 승인 완료, request = 승인 대기 중 */
  source: "manual" | "request";
  /** 어떤 필드가 일치했는지 */
  field: "name" | "businessNumber" | "careInstitutionNumber";
  /** 원본 레코드 id (manual-organization id 또는 request id) */
  existingId: string;
};

/**
 * 기관 등록 신청 시 중복 여부를 모든 저장소에 대해 조사한다.
 *  - `manual-organizations.json` 의 승인 완료 기관
 *  - `registration-requests.json` 의 pending 상태 요청
 *  rejected 요청과는 재신청 허용.
 */
export async function findOrganizationDuplicate(input: {
  name?: string;
  businessNumber?: string;
  careInstitutionNumber?: string;
}): Promise<OrganizationDuplicateMatch | null> {
  const name = String(input.name ?? "").trim();
  const businessNumber = String(input.businessNumber ?? "").trim();
  const careInstitutionNumber = String(input.careInstitutionNumber ?? "").trim();
  if (!name && !businessNumber && !careInstitutionNumber) return null;

  const managed = await listAvailableOrganizations();
  for (const item of managed) {
    if (name && item.name === name) {
      return { source: "manual", field: "name", existingId: item.id };
    }
    const itemBiz = (item as { businessNumber?: string }).businessNumber?.trim();
    if (businessNumber && itemBiz && itemBiz === businessNumber) {
      return { source: "manual", field: "businessNumber", existingId: item.id };
    }
    const itemCin = (item as { careInstitutionNumber?: string }).careInstitutionNumber?.trim();
    if (careInstitutionNumber && itemCin && itemCin === careInstitutionNumber) {
      return { source: "manual", field: "careInstitutionNumber", existingId: item.id };
    }
  }

  const requests = await listOrganizationRegistrationRequests();
  for (const request of requests) {
    if (request.status !== "pending") continue;
    if (name && request.organizationName === name) {
      return { source: "request", field: "name", existingId: request.id };
    }
    if (businessNumber && request.businessNumber === businessNumber) {
      return { source: "request", field: "businessNumber", existingId: request.id };
    }
    if (
      careInstitutionNumber &&
      request.careInstitutionNumber === careInstitutionNumber
    ) {
      return { source: "request", field: "careInstitutionNumber", existingId: request.id };
    }
  }

  return null;
}

/**
 * 이미 승인된 기관(builtin 카탈로그 + manual-organizations.json)에서 이름이 일치하는
 * 첫 항목을 반환한다. 치료사 승인 시 solo 치료사의 requestedOrganizationName 으로
 * 역조회해서 organization_id 를 붙이는 데 사용.
 */
export async function findApprovedOrganizationByName(name: string) {
  const target = String(name ?? "").trim();
  if (!target) return null;
  const items = await listAvailableOrganizations();
  return items.find((item) => item.name === target) ?? null;
}

function normalizeOrgCode(name: string) {
  const compact = name.replace(/\s+/g, "").slice(0, 8).toUpperCase();
  return `ORG-${compact || "CUSTOM"}-${Date.now().toString().slice(-6)}`;
}

export async function createManagedOrganization(input: {
  name: string;
  address: string;
  businessNumber?: string;
  representativeName?: string;
  organizationPhone?: string;
  organizationType?: string;
  careInstitutionNumber?: string;
  medicalInstitutionCode?: string;
  medicalDepartments?: string;
  postalCode?: string;
  roadAddress?: string;
  addressDetail?: string;
  contactName?: string;
  contactTitle?: string;
  contactPhone?: string;
  contactEmail?: string;
  adminLoginEmail?: string;
  twoFactorMethod?: "otp" | "sms";
  servicePurpose?: string;
  targetPatients?: string;
  doctorName?: string;
  doctorLicenseNumber?: string;
}) {
  const name = input.name.trim();
  const address = input.address.trim();
  if (!name || !address) {
    throw new Error("invalid_organization_payload");
  }

  const manual = await readManualOrganizations();
  const duplicate = manual.find(
    (item) => item.name === name || item.businessNumber === input.businessNumber,
  );
  if (duplicate) {
    throw new Error("organization_already_exists");
  }

  const next: ManagedOrganizationEntry = {
    id: randomUUID(),
    code: normalizeOrgCode(name),
    name,
    address,
    businessNumber: String(input.businessNumber ?? "").trim() || undefined,
    representativeName: String(input.representativeName ?? "").trim() || undefined,
    organizationPhone: String(input.organizationPhone ?? "").trim() || undefined,
    organizationType: String(input.organizationType ?? "").trim() || undefined,
    careInstitutionNumber: String(input.careInstitutionNumber ?? "").trim() || undefined,
    medicalInstitutionCode: String(input.medicalInstitutionCode ?? "").trim() || undefined,
    medicalDepartments: String(input.medicalDepartments ?? "").trim() || undefined,
    postalCode: String(input.postalCode ?? "").trim() || undefined,
    roadAddress: String(input.roadAddress ?? "").trim() || undefined,
    addressDetail: String(input.addressDetail ?? "").trim() || undefined,
    contactName: String(input.contactName ?? "").trim() || undefined,
    contactTitle: String(input.contactTitle ?? "").trim() || undefined,
    contactPhone: String(input.contactPhone ?? "").trim() || undefined,
    contactEmail: String(input.contactEmail ?? "").trim() || undefined,
    adminLoginEmail: String(input.adminLoginEmail ?? "").trim() || undefined,
    twoFactorMethod: input.twoFactorMethod,
    servicePurpose: String(input.servicePurpose ?? "").trim() || undefined,
    targetPatients: String(input.targetPatients ?? "").trim() || undefined,
    doctorName: String(input.doctorName ?? "").trim() || undefined,
    doctorLicenseNumber: String(input.doctorLicenseNumber ?? "").trim() || undefined,
    createdAt: new Date().toISOString(),
    source: "manual",
  };

  manual.unshift(next);
  await writeManualOrganizations(manual);
  return next;
}
