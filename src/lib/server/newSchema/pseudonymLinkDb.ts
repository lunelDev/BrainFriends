/**
 * 레거시 `patient_pseudonym_map` 에 신설된 `user_id` 컬럼을 채우는 전용 유틸.
 *
 * 이 테이블 자체는 레거시이지만, 신규 users 테이블과 임상 계층을 연결하는
 * 다리 역할을 한다. 마이그 완료 후 patient_id 컬럼 제거 단계에서
 * 이 파일이 기준점이 된다.
 */
import type { PoolClient } from "pg";
import { getDbPool } from "@/lib/server/postgres";

/**
 * 기존 pseudonym 매핑에 신규 user_id 를 연결한다.
 * 행이 없으면 error — pseudonym_map 행은 레거시 patientIdentityDb 가 먼저 만든다.
 */
export async function linkPseudonymToNewUser(
  client: PoolClient,
  patientPseudonymId: string,
  userId: string,
): Promise<void> {
  const result = await client.query(
    `
      UPDATE patient_pseudonym_map
         SET user_id = $1
       WHERE patient_pseudonym_id = $2
    `,
    [userId, patientPseudonymId],
  );
  if (result.rowCount === 0) {
    throw new Error("pseudonym_map_not_found");
  }
}

export async function getPseudonymIdByUserId(
  client: PoolClient,
  userId: string,
): Promise<string | null> {
  const result = await client.query(
    `SELECT patient_pseudonym_id FROM patient_pseudonym_map WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  return result.rows[0]?.patient_pseudonym_id
    ? String(result.rows[0].patient_pseudonym_id)
    : null;
}

/** 레거시 patient_id 로 pseudonym_id 조회 (가입 시점에는 아직 user_id 연결 전) */
export async function getPseudonymIdByLegacyPatientId(
  patientId: string,
): Promise<string | null> {
  const pool = getDbPool();
  const result = await pool.query(
    `SELECT patient_pseudonym_id FROM patient_pseudonym_map WHERE patient_id = $1 LIMIT 1`,
    [patientId],
  );
  return result.rows[0]?.patient_pseudonym_id
    ? String(result.rows[0].patient_pseudonym_id)
    : null;
}

/** 편의 래퍼 */
export async function linkPseudonymToNewUserStandalone(
  patientPseudonymId: string,
  userId: string,
): Promise<void> {
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await linkPseudonymToNewUser(client, patientPseudonymId, userId);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
