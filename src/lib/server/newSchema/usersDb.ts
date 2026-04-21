/**
 * 신규 `users` 테이블 전용 리포지토리.
 *
 * 이 파일은 기존 `app_users` 를 대체하지 않는다. 기능 플래그
 * `USE_NEW_USERS_SCHEMA` 가 켜져 있을 때만 이중 쓰기의 미러 대상이 된다.
 *
 * 함수들은 모두 `PoolClient` 를 받는다 → 호출측 트랜잭션과 엮을 수 있다.
 */
import type { PoolClient } from "pg";
import { getDbPool } from "@/lib/server/postgres";

export type NewUserAccountType = "USER" | "THERAPIST" | "ADMIN";
export type NewUserStatus = "PENDING" | "ACTIVE" | "SUSPENDED";

/** 신규 users 행의 직렬화 형태 */
export type NewUserRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  loginId: string;
  passwordHash: string;
  loginKeyHash: string | null;
  accountType: NewUserAccountType;
  status: NewUserStatus;
  legacyUserRole: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type UpsertNewUserInput = {
  id: string;
  name: string;
  email: string;
  phone: string;
  loginId: string;
  passwordHash: string;
  loginKeyHash?: string | null;
  accountType: NewUserAccountType;
  status?: NewUserStatus;
  legacyUserRole?: string | null;
};

function rowToUser(row: Record<string, unknown>): NewUserRow {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    phone: String(row.phone ?? ""),
    loginId: String(row.login_id ?? ""),
    passwordHash: String(row.password_hash ?? ""),
    loginKeyHash: row.login_key_hash ? String(row.login_key_hash) : null,
    accountType: String(row.account_type ?? "USER") as NewUserAccountType,
    status: String(row.status ?? "PENDING") as NewUserStatus,
    legacyUserRole: row.legacy_user_role ? String(row.legacy_user_role) : null,
    lastLoginAt: row.last_login_at ? new Date(String(row.last_login_at)) : null,
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

/**
 * 키(id)로 upsert. 이중 쓰기 시 레거시 쪽에서 결정된 user_id 를
 * 그대로 id 로 사용하여 일관성을 유지한다.
 */
export async function upsertNewUser(
  client: PoolClient,
  input: UpsertNewUserInput,
): Promise<NewUserRow> {
  const result = await client.query(
    `
      INSERT INTO users (
        id, name, email, phone,
        login_id, password_hash, login_key_hash,
        account_type, status, legacy_user_role,
        created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE
      SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        login_id = EXCLUDED.login_id,
        password_hash = EXCLUDED.password_hash,
        login_key_hash = COALESCE(EXCLUDED.login_key_hash, users.login_key_hash),
        account_type = EXCLUDED.account_type,
        status = EXCLUDED.status,
        legacy_user_role = COALESCE(EXCLUDED.legacy_user_role, users.legacy_user_role),
        updated_at = NOW()
      RETURNING *
    `,
    [
      input.id,
      input.name,
      input.email,
      input.phone,
      input.loginId,
      input.passwordHash,
      input.loginKeyHash ?? null,
      input.accountType,
      input.status ?? "PENDING",
      input.legacyUserRole ?? null,
    ],
  );
  return rowToUser(result.rows[0]);
}

export async function getNewUserById(
  client: PoolClient,
  id: string,
): Promise<NewUserRow | null> {
  const result = await client.query(`SELECT * FROM users WHERE id = $1`, [id]);
  return result.rows[0] ? rowToUser(result.rows[0]) : null;
}

export async function getNewUserByLoginId(
  client: PoolClient,
  loginId: string,
): Promise<NewUserRow | null> {
  const result = await client.query(
    `SELECT * FROM users WHERE login_id = $1`,
    [loginId],
  );
  return result.rows[0] ? rowToUser(result.rows[0]) : null;
}

export async function setNewUserStatus(
  client: PoolClient,
  id: string,
  status: NewUserStatus,
): Promise<void> {
  await client.query(
    `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2`,
    [status, id],
  );
}

export async function touchNewUserLastLogin(
  client: PoolClient,
  id: string,
): Promise<void> {
  await client.query(
    `UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [id],
  );
}

/** 편의 래퍼 — 자체 트랜잭션을 연다 (단일 쓰기에만 권장) */
export async function upsertNewUserStandalone(
  input: UpsertNewUserInput,
): Promise<NewUserRow> {
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const row = await upsertNewUser(client, input);
    await client.query("COMMIT");
    return row;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
