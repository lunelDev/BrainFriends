import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { mkdir, readFile, readdir, writeFile } from "fs/promises";
import path from "path";
import type { PatientProfile } from "@/lib/patientStorage";

type UserRole = "patient" | "admin" | "therapist" | "prescriber";

type LocalAccountRecord = {
  userId: string;
  patientId: string;
  patientPseudonymId: string | null;
  loginId: string;
  passwordHash: string;
  userRole: UserRole;
  approvalState: "approved" | "pending";
  organizationId: string | null;
  hasAssignedTherapist: boolean;
  fullName: string;
  birthDate: string;
  sex: "M" | "F" | "U";
  phone: string;
  educationYears: number;
  onsetDate: string;
  daysSinceOnset?: number;
  hemiplegia: "Y" | "N";
  hemianopsia: "LEFT" | "RIGHT" | "NONE";
  updatedAt: string;
};

type LocalSessionRecord = {
  sessionId: string;
  sessionTokenHash: string;
  userId: string;
  sessionSeed: string;
  expiresAt: string;
  lastSeenAt: string;
};

type LocalAuthenticated = {
  sessionToken: string;
  expiresAt: Date;
  patient: PatientProfile;
};

type LocalSessionContext = {
  userId: string;
  patientId: string;
  patientPseudonymId: string;
  userRole: UserRole;
  patient: PatientProfile;
};

type LocalAccountSeedInput = {
  userId: string;
  patientId: string;
  patientPseudonymId?: string | null;
  loginId: string;
  passwordHash: string;
  userRole: UserRole;
  approvalState: "approved" | "pending";
  organizationId?: string | null;
  hasAssignedTherapist?: boolean;
  fullName: string;
  birthDate: string;
  sex?: "M" | "F" | "U";
  phone?: string;
  educationYears?: number;
  onsetDate?: string;
  daysSinceOnset?: number;
  hemiplegia?: "Y" | "N";
  hemianopsia?: "LEFT" | "RIGHT" | "NONE";
};

const DATA_DIR = path.join(process.cwd(), "data", "auth");
const ACCOUNTS_PATH = path.join(DATA_DIR, "local-accounts.json");
const SESSIONS_PATH = path.join(DATA_DIR, "local-sessions.json");
const DB_BACKUPS_DIR = path.join(process.cwd(), "data", "db-backups");
const SESSION_TTL_DAYS = 7;

declare global {
  // eslint-disable-next-line no-var
  var __brainfriendsLocalAccountsBootstrapped: boolean | undefined;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function verifyPassword(password: string, storedHash: string) {
  const [salt, expected] = storedHash.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64).toString("hex");
  return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

function calcAge(birthDate: string) {
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return Math.max(age, 0);
}

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  await ensureDir();
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  await ensureDir();
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

async function readAccounts() {
  return readJsonFile<LocalAccountRecord[]>(ACCOUNTS_PATH, []);
}

async function writeAccounts(accounts: LocalAccountRecord[]) {
  await writeJsonFile(ACCOUNTS_PATH, accounts);
}

async function readSessions() {
  return readJsonFile<LocalSessionRecord[]>(SESSIONS_PATH, []);
}

async function writeSessions(sessions: LocalSessionRecord[]) {
  await writeJsonFile(SESSIONS_PATH, sessions);
}

function toPatientProfile(account: LocalAccountRecord, sessionSeed: string): PatientProfile {
  return {
    sessionId: sessionSeed,
    userRole: account.userRole,
    organizationId: account.organizationId,
    hasAssignedTherapist: account.hasAssignedTherapist,
    name: account.fullName,
    birthDate: account.birthDate,
    gender: account.sex,
    age: calcAge(account.birthDate),
    educationYears: account.educationYears,
    onsetDate: account.onsetDate,
    daysSinceOnset: account.daysSinceOnset,
    hemiplegia: account.hemiplegia,
    hemianopsia: account.hemianopsia,
    phone: account.phone,
    hand: "U",
    language: "한국어",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function parseCopyTable(sql: string, tableName: string) {
  const pattern = new RegExp(
    `COPY public\\.${tableName} \\(([^)]+)\\) FROM stdin;\\r?\\n([\\s\\S]*?)\\r?\\n\\\\\\.`,
    "m",
  );
  const match = sql.match(pattern);
  if (!match) return [] as Record<string, string | null>[];
  const columns = match[1].split(",").map((item) => item.trim());
  const rows = match[2]
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const values = line.split("\t");
      const row: Record<string, string | null> = {};
      columns.forEach((column, index) => {
        const value = values[index];
        row[column] = value === "\\N" || value === undefined ? null : value;
      });
      return row;
    });
  return rows;
}

async function getLatestBackupPath() {
  try {
    const entries = await readdir(DB_BACKUPS_DIR);
    const sqlFiles = entries.filter((item) => item.endsWith(".sql")).sort().reverse();
    if (!sqlFiles.length) return null;
    return path.join(DB_BACKUPS_DIR, sqlFiles[0]);
  } catch {
    return null;
  }
}

async function bootstrapAccountsFromLatestBackup() {
  if (global.__brainfriendsLocalAccountsBootstrapped) return;
  global.__brainfriendsLocalAccountsBootstrapped = true;

  const existing = await readAccounts();
  if (existing.length) return;

  const backupPath = await getLatestBackupPath();
  if (!backupPath) return;

  const sql = await readFile(backupPath, "utf8").catch(() => "");
  if (!sql) return;

  const users = parseCopyTable(sql, "app_users");
  const patientPii = parseCopyTable(sql, "patient_pii");
  const intakeProfiles = parseCopyTable(sql, "patient_intake_profiles");
  const pseudonymMap = parseCopyTable(sql, "patient_pseudonym_map");

  const piiByPatientId = new Map(patientPii.map((row) => [String(row.patient_id), row]));
  const intakeByPatientId = new Map(
    intakeProfiles.map((row) => [String(row.patient_id), row]),
  );
  const pseudonymByPatientId = new Map(
    pseudonymMap.map((row) => [String(row.patient_id), row]),
  );

  const accounts: LocalAccountRecord[] = users
    .filter((row) => row.login_id && row.password_hash && row.patient_id && row.user_id)
    .map((row) => {
      const patientId = String(row.patient_id);
      const pii = piiByPatientId.get(patientId);
      const intake = intakeByPatientId.get(patientId);
      const pseudonym = pseudonymByPatientId.get(patientId);
      return {
        userId: String(row.user_id),
        patientId,
        patientPseudonymId: pseudonym?.patient_pseudonym_id ? String(pseudonym.patient_pseudonym_id) : null,
        loginId: String(row.login_id),
        passwordHash: String(row.password_hash),
        userRole:
          row.user_role === "admin" ||
          row.user_role === "therapist" ||
          row.user_role === "prescriber"
            ? (row.user_role as UserRole)
            : "patient",
        approvalState: row.approval_state === "pending" ? "pending" : "approved",
        organizationId: row.organization_id ? String(row.organization_id) : null,
        hasAssignedTherapist: row.user_role === "patient" ? Boolean(row.organization_id) : false,
        fullName: pii?.full_name ? String(pii.full_name) : String(row.login_id),
        birthDate: pii?.birth_date ? String(pii.birth_date) : "",
        sex:
          pii?.sex === "M" || pii?.sex === "F"
            ? (pii.sex as "M" | "F")
            : "U",
        phone: pii?.phone ? String(pii.phone) : "",
        educationYears: intake?.education_years ? Number(intake.education_years) : 0,
        onsetDate: intake?.onset_date ? String(intake.onset_date) : "",
        daysSinceOnset: intake?.days_since_onset ? Number(intake.days_since_onset) : undefined,
        hemiplegia: intake?.hemiplegia === "Y" ? "Y" : "N",
        hemianopsia:
          intake?.hemianopsia === "LEFT" || intake?.hemianopsia === "RIGHT"
            ? (intake.hemianopsia as "LEFT" | "RIGHT")
            : "NONE",
        updatedAt: new Date().toISOString(),
      };
    });

  if (accounts.length) {
    await writeAccounts(accounts);
  }
}

export async function upsertLocalAuthAccount(input: LocalAccountSeedInput) {
  const accounts = await readAccounts();
  const next: LocalAccountRecord = {
    userId: String(input.userId),
    patientId: String(input.patientId),
    patientPseudonymId: input.patientPseudonymId ? String(input.patientPseudonymId) : null,
    loginId: String(input.loginId).trim().toLowerCase(),
    passwordHash: String(input.passwordHash),
    userRole: input.userRole,
    approvalState: input.approvalState,
    organizationId: input.organizationId ? String(input.organizationId) : null,
    hasAssignedTherapist: Boolean(input.hasAssignedTherapist),
    fullName: String(input.fullName).trim(),
    birthDate: String(input.birthDate ?? "").trim(),
    sex: input.sex === "M" || input.sex === "F" ? input.sex : "U",
    phone: String(input.phone ?? "").trim(),
    educationYears: Number(input.educationYears ?? 0),
    onsetDate: String(input.onsetDate ?? "").trim(),
    daysSinceOnset: input.daysSinceOnset,
    hemiplegia: input.hemiplegia === "Y" ? "Y" : "N",
    hemianopsia:
      input.hemianopsia === "LEFT" || input.hemianopsia === "RIGHT"
        ? input.hemianopsia
        : "NONE",
    updatedAt: new Date().toISOString(),
  };

  const index = accounts.findIndex((item) => item.userId === next.userId);
  if (index >= 0) {
    accounts[index] = next;
  } else {
    accounts.unshift(next);
  }
  await writeAccounts(accounts);
}

export async function authenticateLocalAccount(input: {
  loginId: string;
  password: string;
}): Promise<LocalAuthenticated> {
  await bootstrapAccountsFromLatestBackup();
  const accounts = await readAccounts();
  const account = accounts.find(
    (item) => item.loginId === String(input.loginId).trim().toLowerCase(),
  );
  if (!account || !verifyPassword(String(input.password), account.passwordHash)) {
    throw new Error("invalid_credentials");
  }
  if (account.userRole === "therapist" && account.approvalState !== "approved") {
    throw new Error("approval_pending");
  }

  const sessionToken = randomBytes(32).toString("base64url");
  const sessionSeed = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const sessions = await readSessions();
  sessions.unshift({
    sessionId: randomUUID(),
    sessionTokenHash: sha256(sessionToken),
    userId: account.userId,
    sessionSeed,
    expiresAt: expiresAt.toISOString(),
    lastSeenAt: new Date().toISOString(),
  });
  await writeSessions(sessions);

  return {
    sessionToken,
    expiresAt,
    patient: toPatientProfile(account, sessionSeed),
  };
}

export async function getLocalPatientProfileFromSession(sessionToken: string) {
  await bootstrapAccountsFromLatestBackup();
  const sessions = await readSessions();
  const sessionHash = sha256(sessionToken);
  const session = sessions.find(
    (item) => item.sessionTokenHash === sessionHash && new Date(item.expiresAt).getTime() > Date.now(),
  );
  if (!session) return null;

  const accounts = await readAccounts();
  const account = accounts.find((item) => item.userId === session.userId);
  if (!account) return null;
  if (account.userRole === "therapist" && account.approvalState !== "approved") {
    return null;
  }

  session.lastSeenAt = new Date().toISOString();
  await writeSessions(sessions);
  return toPatientProfile(account, session.sessionSeed);
}

export async function getLocalSessionContext(sessionToken: string): Promise<LocalSessionContext | null> {
  await bootstrapAccountsFromLatestBackup();
  const sessions = await readSessions();
  const sessionHash = sha256(sessionToken);
  const session = sessions.find(
    (item) => item.sessionTokenHash === sessionHash && new Date(item.expiresAt).getTime() > Date.now(),
  );
  if (!session) return null;

  const accounts = await readAccounts();
  const account = accounts.find((item) => item.userId === session.userId);
  if (!account) return null;
  if (account.userRole === "therapist" && account.approvalState !== "approved") {
    return null;
  }

  session.lastSeenAt = new Date().toISOString();
  await writeSessions(sessions);

  return {
    userId: account.userId,
    patientId: account.patientId,
    patientPseudonymId: account.patientPseudonymId ?? `local-${account.patientId}`,
    userRole: account.userRole,
    patient: toPatientProfile(account, session.sessionSeed),
  };
}

export async function invalidateLocalSession(sessionToken: string) {
  const sessions = await readSessions();
  const sessionHash = sha256(sessionToken);
  const next = sessions.filter((item) => item.sessionTokenHash !== sessionHash);
  if (next.length !== sessions.length) {
    await writeSessions(next);
  }
}
