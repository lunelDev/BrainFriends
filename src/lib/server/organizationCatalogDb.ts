import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  ORGANIZATION_CATALOG,
  type OrganizationCatalogEntry,
} from "@/lib/organizations/catalog";

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
