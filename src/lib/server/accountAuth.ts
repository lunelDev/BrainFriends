import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "crypto";
import type { PatientProfile } from "@/lib/patientStorage";
import { getDbPool } from "@/lib/server/postgres";
import { upsertPatientIdentity } from "@/lib/server/patientIdentityDb";

export const AUTH_COOKIE_NAME = "brainfriends_session";
const SESSION_TTL_DAYS = 30;
const BUILTIN_ADMIN_LOGIN_ID = "admin";
const BUILTIN_ADMIN_PASSWORD = "0000";
export type UserRole = "patient" | "admin" | "therapist";

export type SignupAccountInput = {
  userRole?: UserRole;
  loginId: string;
  name: string;
  birthDate: string;
  phoneLast4: string;
  password: string;
  gender?: PatientProfile["gender"];
  educationYears?: number;
  onsetDate?: string;
  hemiplegia?: NonNullable<PatientProfile["hemiplegia"]>;
  hemianopsia?: NonNullable<PatientProfile["hemianopsia"]>;
};

export type LoginAccountInput = {
  loginId: string;
  password: string;
};

export type RecoveryIdentityInput = {
  name: string;
  birthDate: string;
  phoneLast4: string;
};

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function normalizeBirthDate(value: string) {
  return value.trim();
}

function normalizePhoneLast4(value: string) {
  return value.replace(/\D/g, "").slice(0, 4);
}

function normalizeLoginId(value: string) {
  return value.trim().toLowerCase();
}

function isValidLoginIdFormat(value: string) {
  return /^[a-z0-9_-]{4,20}$/.test(value);
}

function buildLoginKey(input: {
  name: string;
  birthDate: string;
  phoneLast4: string;
}) {
  return [
    normalizeName(input.name).toLowerCase(),
    normalizeBirthDate(input.birthDate),
    normalizePhoneLast4(input.phoneLast4),
  ].join("|");
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
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

function calcDaysSinceOnset(onsetDate: string) {
  const onset = new Date(`${onsetDate}T00:00:00`);
  if (Number.isNaN(onset.getTime())) return undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = today.getTime() - onset.getTime();
  return diffMs < 0 ? 0 : Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

function normalizeUserRole(value: string | null | undefined): UserRole {
  if (value === "admin") return "admin";
  if (value === "therapist") return "therapist";
  return "patient";
}

export function buildPatientProfile(row: {
  session_seed: string;
  user_role?: UserRole | null;
  full_name: string;
  birth_date: string | null;
  sex: PatientProfile["gender"] | null;
  phone: string | null;
  education_years: number | null;
  onset_date: string | null;
  days_since_onset: number | null;
  hemiplegia: PatientProfile["hemiplegia"] | null;
  hemianopsia: PatientProfile["hemianopsia"] | null;
}) {
  const birthDate = row.birth_date ?? "";
  return {
    sessionId: row.session_seed || randomUUID(),
    userRole: normalizeUserRole(row.user_role),
    name: row.full_name,
    birthDate,
    gender: row.sex ?? "U",
    age: calcAge(birthDate),
    educationYears: Number(row.education_years ?? 0),
    onsetDate: row.onset_date ?? "",
    daysSinceOnset: row.days_since_onset ?? calcDaysSinceOnset(row.onset_date ?? ""),
    hemiplegia: row.hemiplegia ?? "N",
    hemianopsia: row.hemianopsia ?? "NONE",
    phone: row.phone ?? "",
    hand: "U",
    language: "한국어",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  } satisfies PatientProfile;
}

function validatePassword(password: string) {
  return password.length >= 6;
}

export function sanitizeLoginId(value: string) {
  return normalizeLoginId(value);
}

export function validateLoginId(value: string) {
  return isValidLoginIdFormat(normalizeLoginId(value));
}

async function ensureBuiltinAdminAccount(client: any) {
  const patientProfile = {
    sessionId: randomUUID(),
    userRole: "admin" as const,
    name: "관리자",
    birthDate: "1970-01-01",
    gender: "U" as const,
    age: calcAge("1970-01-01"),
    educationYears: 0,
    onsetDate: "",
    daysSinceOnset: undefined,
    hemiplegia: "N" as const,
    hemianopsia: "NONE" as const,
    phone: "0000",
    hand: "U" as const,
    language: "한국어",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  } satisfies PatientProfile;

  const loginKeyHash = sha256(
    buildLoginKey({
      name: patientProfile.name,
      birthDate: patientProfile.birthDate,
      phoneLast4: "0000",
    }),
  );
  const { patientId } = await upsertPatientIdentity(client, patientProfile);
  const userId = randomUUID();

  await client.query(
    `
      INSERT INTO patient_intake_profiles (
        patient_id,
        education_years,
        onset_date,
        days_since_onset,
        hemiplegia,
        hemianopsia,
        hand,
        created_at,
        updated_at
      )
      VALUES ($1, $2, NULL, NULL, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (patient_id) DO UPDATE
      SET
        education_years = EXCLUDED.education_years,
        hemiplegia = EXCLUDED.hemiplegia,
        hemianopsia = EXCLUDED.hemianopsia,
        hand = EXCLUDED.hand,
        updated_at = NOW()
    `,
    [patientId, 0, "N", "NONE", "U"],
  );

  await client.query(
    `
      INSERT INTO app_users (
        user_id,
        patient_id,
        user_role,
        login_id,
        login_key_hash,
        password_hash,
        created_at,
        updated_at
      )
      VALUES ($1, $2, 'admin', $3, $4, $5, NOW(), NOW())
      ON CONFLICT (login_id) DO UPDATE
      SET
        patient_id = EXCLUDED.patient_id,
        user_role = 'admin',
        login_key_hash = EXCLUDED.login_key_hash,
        password_hash = EXCLUDED.password_hash,
        updated_at = NOW()
    `,
    [
      userId,
      patientId,
      BUILTIN_ADMIN_LOGIN_ID,
      loginKeyHash,
      hashPassword(BUILTIN_ADMIN_PASSWORD),
    ],
  );
}

export async function createAccount(input: SignupAccountInput) {
  const userRole = normalizeUserRole(input.userRole);
  const loginId = normalizeLoginId(input.loginId);
  const name = normalizeName(input.name);
  const birthDate = normalizeBirthDate(input.birthDate);
  const phoneLast4 = normalizePhoneLast4(input.phoneLast4);

  if (
    !loginId ||
    !isValidLoginIdFormat(loginId) ||
    loginId === BUILTIN_ADMIN_LOGIN_ID ||
    !name ||
    !birthDate ||
    phoneLast4.length !== 4 ||
    !validatePassword(input.password)
  ) {
    throw new Error("invalid_signup_payload");
  }

  if (
    userRole === "patient" &&
    (!input.onsetDate ||
      !input.educationYears ||
      (input.gender !== "M" && input.gender !== "F"))
  ) {
    throw new Error("invalid_signup_payload");
  }

  const educationYears = Number(input.educationYears ?? 0);
  const onsetDate = String(input.onsetDate ?? "");
  const gender =
    input.gender === "M" || input.gender === "F" ? input.gender : "U";
  const hemiplegia = input.hemiplegia === "Y" ? "Y" : "N";
  const hemianopsia =
    input.hemianopsia === "LEFT" || input.hemianopsia === "RIGHT"
      ? input.hemianopsia
      : "NONE";

  const loginKeyHash = sha256(buildLoginKey({ name, birthDate, phoneLast4 }));
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT user_id FROM app_users WHERE login_id = $1 OR login_key_hash = $2 LIMIT 1`,
      [loginId, loginKeyHash],
    );
    if (existing.rowCount) {
      throw new Error("account_already_exists");
    }

    const patientProfile = {
      sessionId: randomUUID(),
      name,
      birthDate,
      gender,
      age: calcAge(birthDate),
      educationYears,
      onsetDate,
      daysSinceOnset: calcDaysSinceOnset(onsetDate),
      hemiplegia,
      hemianopsia,
      phone: phoneLast4,
      hand: "U" as const,
      language: "한국어",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } satisfies PatientProfile;

    const { patientId } = await upsertPatientIdentity(client, patientProfile);
    const userId = randomUUID();

    await client.query(
      `
        INSERT INTO patient_intake_profiles (
          patient_id,
          education_years,
          onset_date,
          days_since_onset,
          hemiplegia,
          hemianopsia,
          hand,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        ON CONFLICT (patient_id) DO UPDATE
        SET
          education_years = EXCLUDED.education_years,
          onset_date = EXCLUDED.onset_date,
          days_since_onset = EXCLUDED.days_since_onset,
          hemiplegia = EXCLUDED.hemiplegia,
          hemianopsia = EXCLUDED.hemianopsia,
          hand = EXCLUDED.hand,
          updated_at = NOW()
      `,
      [
        patientId,
        educationYears,
        onsetDate || null,
        calcDaysSinceOnset(onsetDate) ?? null,
        hemiplegia,
        hemianopsia,
        "U",
      ],
    );

    await client.query(
      `
        INSERT INTO app_users (
          user_id,
          patient_id,
          user_role,
          login_id,
          login_key_hash,
          password_hash,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      `,
      [
        userId,
        patientId,
        userRole,
        loginId,
        loginKeyHash,
        hashPassword(input.password),
      ],
    );

    await client.query("COMMIT");
    return { userId, patientId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function authenticateAccount(input: LoginAccountInput) {
  const loginId = normalizeLoginId(input.loginId);
  if (!loginId || !isValidLoginIdFormat(loginId) || !input.password) {
    throw new Error("invalid_login_payload");
  }

  const pool = getDbPool();
  const client = await pool.connect();

  try {
    if (loginId === BUILTIN_ADMIN_LOGIN_ID && input.password === BUILTIN_ADMIN_PASSWORD) {
      await client.query("BEGIN");
      try {
        await ensureBuiltinAdminAccount(client);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    const result = await client.query(
      `
        SELECT
          u.user_id,
          COALESCE(u.user_role, 'patient') AS user_role,
          u.password_hash,
          pii.full_name,
          pii.birth_date::text,
          pii.sex,
          pii.phone,
          intake.education_years,
          intake.onset_date::text,
          intake.days_since_onset,
          intake.hemiplegia,
          intake.hemianopsia
        FROM app_users u
        JOIN patient_pii pii ON pii.patient_id = u.patient_id
        LEFT JOIN patient_intake_profiles intake ON intake.patient_id = u.patient_id
        WHERE u.login_id = $1
        LIMIT 1
      `,
      [loginId],
    );

    const row = result.rows[0];
    if (!row || !verifyPassword(input.password, row.password_hash)) {
      throw new Error("invalid_credentials");
    }

    const sessionToken = randomBytes(32).toString("base64url");
    const sessionId = randomUUID();
    const sessionSeed = randomUUID();
    const expiresAt = new Date(
      Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    await client.query(
      `
        INSERT INTO auth_sessions (
          session_id,
          user_id,
          session_token_hash,
          session_seed,
          expires_at,
          created_at,
          last_seen_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      `,
      [sessionId, row.user_id, sha256(sessionToken), sessionSeed, expiresAt],
    );

    await client.query(
      `
        UPDATE app_users
        SET last_login_at = NOW(), updated_at = NOW()
        WHERE user_id = $1
      `,
      [row.user_id],
    );

    return {
      sessionToken,
      expiresAt,
      patient: buildPatientProfile({
        session_seed: sessionSeed,
        user_role: row.user_role,
        full_name: row.full_name,
        birth_date: row.birth_date,
        sex: row.sex,
        phone: row.phone,
        education_years: row.education_years,
        onset_date: row.onset_date,
        days_since_onset: row.days_since_onset,
        hemiplegia: row.hemiplegia,
        hemianopsia: row.hemianopsia,
      }),
    };
  } finally {
    client.release();
  }
}

export async function getPatientProfileFromSession(sessionToken: string) {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `
        SELECT
          s.session_id,
          s.session_seed,
          COALESCE(u.user_role, 'patient') AS user_role,
          pii.full_name,
          pii.birth_date::text,
          pii.sex,
          pii.phone,
          intake.education_years,
          intake.onset_date::text,
          intake.days_since_onset,
          intake.hemiplegia,
          intake.hemianopsia
        FROM auth_sessions s
        JOIN app_users u ON u.user_id = s.user_id
        JOIN patient_pii pii ON pii.patient_id = u.patient_id
        LEFT JOIN patient_intake_profiles intake ON intake.patient_id = u.patient_id
        WHERE s.session_token_hash = $1
          AND s.expires_at > NOW()
        LIMIT 1
      `,
      [sha256(sessionToken)],
    );

    const row = result.rows[0];
    if (!row) return null;

    await client.query(
      `UPDATE auth_sessions SET last_seen_at = NOW() WHERE session_id = $1`,
      [row.session_id],
    );

    return buildPatientProfile({
      session_seed: row.session_seed,
      user_role: row.user_role,
      full_name: row.full_name,
      birth_date: row.birth_date,
      sex: row.sex,
      phone: row.phone,
      education_years: row.education_years,
      onset_date: row.onset_date,
      days_since_onset: row.days_since_onset,
      hemiplegia: row.hemiplegia,
      hemianopsia: row.hemianopsia,
    });
  } finally {
    client.release();
  }
}

export async function getAuthenticatedSessionContext(sessionToken: string) {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `
        SELECT
          s.session_id,
          s.session_seed,
          COALESCE(u.user_role, 'patient') AS user_role,
          u.user_id::text AS user_id,
          u.patient_id::text AS patient_id,
          ppm.patient_pseudonym_id,
          pii.full_name,
          pii.birth_date::text,
          pii.sex,
          pii.phone,
          intake.education_years,
          intake.onset_date::text,
          intake.days_since_onset,
          intake.hemiplegia,
          intake.hemianopsia
        FROM auth_sessions s
        JOIN app_users u ON u.user_id = s.user_id
        JOIN patient_pii pii ON pii.patient_id = u.patient_id
        JOIN patient_pseudonym_map ppm ON ppm.patient_id = u.patient_id
        LEFT JOIN patient_intake_profiles intake ON intake.patient_id = u.patient_id
        WHERE s.session_token_hash = $1
          AND s.expires_at > NOW()
        LIMIT 1
      `,
      [sha256(sessionToken)],
    );

    const row = result.rows[0];
    if (!row) return null;

    await client.query(
      `UPDATE auth_sessions SET last_seen_at = NOW() WHERE session_id = $1`,
      [row.session_id],
    );

    return {
      userId: String(row.user_id),
      patientId: String(row.patient_id),
      patientPseudonymId: String(row.patient_pseudonym_id),
      userRole: normalizeUserRole(row.user_role),
      patient: buildPatientProfile({
        session_seed: row.session_seed,
        user_role: row.user_role,
        full_name: row.full_name,
        birth_date: row.birth_date,
        sex: row.sex,
        phone: row.phone,
        education_years: row.education_years,
        onset_date: row.onset_date,
        days_since_onset: row.days_since_onset,
        hemiplegia: row.hemiplegia,
        hemianopsia: row.hemianopsia,
      }),
    };
  } finally {
    client.release();
  }
}

export async function invalidateSession(sessionToken: string) {
  const pool = getDbPool();
  await pool.query(`DELETE FROM auth_sessions WHERE session_token_hash = $1`, [
    sha256(sessionToken),
  ]);
}

export async function isLoginIdAvailable(loginIdInput: string) {
  const loginId = normalizeLoginId(loginIdInput);
  if (!isValidLoginIdFormat(loginId)) {
    return {
      available: false,
      reason: "invalid_format",
      normalizedLoginId: loginId,
    } as const;
  }

  if (loginId === BUILTIN_ADMIN_LOGIN_ID) {
    return {
      available: false,
      reason: "reserved_admin",
      normalizedLoginId: loginId,
    } as const;
  }

  const pool = getDbPool();
  const result = await pool.query(
    `SELECT 1 FROM app_users WHERE login_id = $1 LIMIT 1`,
    [loginId],
  );

  return {
    available: result.rowCount === 0,
    reason: result.rowCount === 0 ? null : "already_taken",
    normalizedLoginId: loginId,
  } as const;
}

function validateRecoveryIdentity(input: RecoveryIdentityInput) {
  const name = normalizeName(input.name);
  const birthDate = normalizeBirthDate(input.birthDate);
  const phoneLast4 = normalizePhoneLast4(input.phoneLast4);
  if (!name || !birthDate || phoneLast4.length !== 4) {
    throw new Error("invalid_recovery_payload");
  }
  return { name, birthDate, phoneLast4 };
}

export async function findLoginIdByIdentity(input: RecoveryIdentityInput) {
  const { name, birthDate, phoneLast4 } = validateRecoveryIdentity(input);
  const loginKeyHash = sha256(buildLoginKey({ name, birthDate, phoneLast4 }));
  const pool = getDbPool();
  const result = await pool.query(
    `
      SELECT login_id
      FROM app_users
      WHERE login_key_hash = $1
      LIMIT 1
    `,
    [loginKeyHash],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("account_not_found");
  }

  return {
    loginId: String(row.login_id),
  };
}

export async function resetPasswordByIdentity(input: RecoveryIdentityInput & {
  newPassword: string;
}) {
  const { name, birthDate, phoneLast4 } = validateRecoveryIdentity(input);
  if (!validatePassword(input.newPassword)) {
    throw new Error("invalid_password_payload");
  }

  const loginKeyHash = sha256(buildLoginKey({ name, birthDate, phoneLast4 }));
  const pool = getDbPool();
  const result = await pool.query(
    `
      UPDATE app_users
      SET password_hash = $2, updated_at = NOW()
      WHERE login_key_hash = $1
      RETURNING user_id
    `,
    [loginKeyHash, hashPassword(input.newPassword)],
  );

  if (!result.rowCount) {
    throw new Error("account_not_found");
  }

  await pool.query(
    `
      DELETE FROM auth_sessions
      WHERE user_id = $1
    `,
    [result.rows[0].user_id],
  );

  return { ok: true };
}
