import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type TherapistTwoFactorMethod = "otp" | "sms";
export type TherapistAccessRole = "manager" | "therapist" | "observer";
export type TherapistProfession =
  | "speech"
  | "occupational"
  | "physical"
  | "cognitive"
  | "other";
export type TherapistEmploymentStatus = "employed" | "contract" | "freelance";
export type TherapistIrbParticipation = "none" | "planned" | "approved";

type TherapistRegistrationProfileStore = {
  userId: string;
  organizationId?: string;
  requestedOrganizationName?: string;
  therapistName: string;
  birthDate: string;
  gender: "M" | "F" | "U";
  phone: string;
  email: string;
  profession: TherapistProfession;
  licenseNumber: string;
  licenseFileName: string;
  licenseFileDataUrl?: string;
  licenseIssuedBy: string;
  licenseIssuedDate: string;
  employmentStatus?: TherapistEmploymentStatus;
  department?: string;
  twoFactorMethod?: TherapistTwoFactorMethod;
  accessRole: TherapistAccessRole;
  canViewPatients: boolean;
  canEditPatientData: boolean;
  canEnterEvaluation: boolean;
  experienceYears?: number;
  specialties?: string;
  servicePurpose?: string;
  targetPatientTypes?: string;
  dataConsentScope?: string;
  irbParticipation?: TherapistIrbParticipation;
  privacyAgreed: boolean;
  patientDataAccessAgreed: boolean;
  securityPolicyAgreed: boolean;
  confidentialityAgreed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TherapistRegistrationProfile = Omit<
  TherapistRegistrationProfileStore,
  "licenseFileDataUrl"
>;

type CreateTherapistRegistrationProfileInput = Omit<
  TherapistRegistrationProfileStore,
  "createdAt" | "updatedAt"
>;

const DATA_DIR = path.join(process.cwd(), "data", "therapists");
const PROFILES_PATH = path.join(DATA_DIR, "registration-profiles.json");

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readProfiles(): Promise<TherapistRegistrationProfileStore[]> {
  await ensureDir();
  try {
    const raw = await readFile(PROFILES_PATH, "utf8");
    const parsed = JSON.parse(raw) as TherapistRegistrationProfileStore[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeProfiles(items: TherapistRegistrationProfileStore[]) {
  await ensureDir();
  await writeFile(PROFILES_PATH, JSON.stringify(items, null, 2), "utf8");
}

function toPublicProfile(
  item: TherapistRegistrationProfileStore,
): TherapistRegistrationProfile {
  const { licenseFileDataUrl, ...rest } = item;
  void licenseFileDataUrl;
  return rest;
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function normalizePhone(value: unknown) {
  return String(value ?? "").replace(/[^\d-]/g, "").trim();
}

function normalizeDate(value: unknown) {
  const text = normalizeText(value);
  if (!text) {
    throw new Error("invalid_therapist_profile");
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("invalid_therapist_profile");
  }
  return text;
}

export async function listTherapistRegistrationProfiles() {
  const items = await readProfiles();
  return items.map(toPublicProfile);
}

export async function getTherapistRegistrationProfilesByUserIds(userIds: string[]) {
  if (!userIds.length) return [] as TherapistRegistrationProfile[];
  const userIdSet = new Set(userIds.map((item) => String(item).trim()).filter(Boolean));
  const items = await readProfiles();
  return items
    .filter((item) => userIdSet.has(item.userId))
    .map(toPublicProfile);
}

/**
 * requestedOrganizationName(solo 가입 시 입력한 기관명)이 일치하는 프로필들에
 * organizationId 를 주입한다. 기관 승인 시점에 호출되어 치료사와 새 기관을 묶는다.
 *
 * 이미 organizationId 가 있는 프로필은 건드리지 않는다 (먼저 승인된 쪽을 존중).
 *
 * @returns organizationId 가 주입된 프로필 userId 목록 (후속 app_users 업데이트용)
 */
export async function linkTherapistProfilesToOrganization(
  requestedOrganizationName: string,
  organizationId: string,
): Promise<string[]> {
  const name = normalizeText(requestedOrganizationName);
  const orgId = normalizeText(organizationId);
  if (!name || !orgId) return [];

  const items = await readProfiles();
  const linkedUserIds: string[] = [];
  let mutated = false;
  for (const item of items) {
    if (item.organizationId) continue;
    if (normalizeText(item.requestedOrganizationName) !== name) continue;
    item.organizationId = orgId;
    item.updatedAt = new Date().toISOString();
    linkedUserIds.push(item.userId);
    mutated = true;
  }
  if (mutated) {
    await writeProfiles(items);
  }
  return linkedUserIds;
}

export async function upsertTherapistRegistrationProfile(
  input: CreateTherapistRegistrationProfileInput,
) {
  const next: TherapistRegistrationProfileStore = {
    userId: normalizeText(input.userId),
    organizationId: normalizeText(input.organizationId) || undefined,
    requestedOrganizationName: normalizeText(input.requestedOrganizationName) || undefined,
    therapistName: normalizeText(input.therapistName),
    birthDate: normalizeDate(input.birthDate),
    gender: input.gender === "M" || input.gender === "F" ? input.gender : "U",
    phone: normalizePhone(input.phone),
    email: normalizeEmail(input.email),
    profession:
      input.profession === "speech" ||
      input.profession === "occupational" ||
      input.profession === "physical" ||
      input.profession === "cognitive"
        ? input.profession
        : "other",
    licenseNumber: normalizeText(input.licenseNumber),
    licenseFileName: normalizeText(input.licenseFileName),
    licenseFileDataUrl: normalizeText(input.licenseFileDataUrl) || undefined,
    licenseIssuedBy: normalizeText(input.licenseIssuedBy),
    licenseIssuedDate: normalizeDate(input.licenseIssuedDate),
    employmentStatus:
      input.employmentStatus === "contract" || input.employmentStatus === "freelance"
        ? input.employmentStatus
        : undefined,
    department: normalizeText(input.department) || undefined,
    twoFactorMethod: input.twoFactorMethod === "sms" ? "sms" : undefined,
    accessRole:
      input.accessRole === "manager" || input.accessRole === "observer"
        ? input.accessRole
        : "therapist",
    canViewPatients: Boolean(input.canViewPatients),
    canEditPatientData: Boolean(input.canEditPatientData),
    canEnterEvaluation: Boolean(input.canEnterEvaluation),
    experienceYears:
      typeof input.experienceYears === "number" && Number.isFinite(input.experienceYears)
        ? input.experienceYears
        : undefined,
    specialties: normalizeText(input.specialties) || undefined,
    servicePurpose: normalizeText(input.servicePurpose) || undefined,
    targetPatientTypes: normalizeText(input.targetPatientTypes) || undefined,
    dataConsentScope: normalizeText(input.dataConsentScope) || undefined,
    irbParticipation:
      input.irbParticipation === "planned" || input.irbParticipation === "approved"
        ? input.irbParticipation
        : undefined,
    privacyAgreed: Boolean(input.privacyAgreed),
    patientDataAccessAgreed: Boolean(input.patientDataAccessAgreed),
    securityPolicyAgreed: Boolean(input.securityPolicyAgreed),
    confidentialityAgreed: Boolean(input.confidentialityAgreed),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const requiredChecks = [
    next.userId,
    next.therapistName,
    next.birthDate,
    next.phone,
    next.email,
    next.licenseNumber,
    next.licenseFileName,
    next.licenseIssuedBy,
    next.licenseIssuedDate,
    next.privacyAgreed,
    next.patientDataAccessAgreed,
    next.securityPolicyAgreed,
    next.confidentialityAgreed,
  ];

  if (requiredChecks.some((item) => !item)) {
    throw new Error("invalid_therapist_profile");
  }

  const items = await readProfiles();
  const existingIndex = items.findIndex((item) => item.userId === next.userId);
  if (existingIndex >= 0) {
    next.createdAt = items[existingIndex].createdAt;
    next.updatedAt = new Date().toISOString();
    items[existingIndex] = next;
  } else {
    items.unshift(next);
  }

  await writeProfiles(items);
  return toPublicProfile(next);
}
