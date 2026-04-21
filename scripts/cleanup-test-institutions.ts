/**
 * BrainFriends 테스트 기관/치료사 정리 스크립트
 *
 * 용도: 개발 환경에서 제대로 입력되지 않은 치료사 회원 기관과
 *       관련 등록 요청·치료사 계정을 완전 삭제한다.
 *
 * 삭제 대상 (이 스크립트가 고정으로 정리하는 3개 기관):
 *   - 울산대학병원
 *   - 지수병원
 *   - 대한독립만세
 *
 * 사용법:
 *   # 드라이런 — 실제 삭제 없이 대상만 출력
 *   npx tsx scripts/cleanup-test-institutions.ts
 *
 *   # 실제 삭제
 *   npx tsx scripts/cleanup-test-institutions.ts --yes
 *
 *   # 고아 치료사(organization_id NULL)까지 전부 정리 (개발 편의용)
 *   npx tsx scripts/cleanup-test-institutions.ts --yes --wipe-orphan-therapists
 *
 * 안전장치:
 *   - localhost DB 가 아니면 거부
 *   - --yes 플래그가 없으면 드라이런만 실행
 *   - DB 작업은 단일 트랜잭션 (전부 성공 또는 전부 롤백)
 *   - JSON 파일은 백업 후 덮어쓰기 (data/cleanup-backups/<timestamp>/ 에 원본 보관)
 */

import { Pool } from "pg";
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  copyFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

// 삭제 대상 기관 이름 고정 목록
const TARGET_ORG_NAMES = new Set(["울산대학병원", "지수병원", "대한독립만세"]);

// ──────────── env 로드 ────────────

function loadEnvLocal(): void {
  const envPath = join(projectRoot, ".env.local");
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx < 0) continue;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}
loadEnvLocal();

// ──────────── 안전 체크 ────────────

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL 이 .env.local 에 없습니다.");
  process.exit(1);
}
const hostMatch = dbUrl.match(/@([^:/]+)(:\d+)?\//);
const host = hostMatch?.[1] ?? "(unknown)";
if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
  console.error(`로컬 DB 가 아닙니다 (host=${host}). 작업 중단.`);
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const apply = args.has("--yes");
const wipeOrphans = args.has("--wipe-orphan-therapists");

// ──────────── 경로/유틸 ────────────

const manualOrgsPath = join(projectRoot, "data", "organizations", "manual-organizations.json");
const orgRequestsPath = join(projectRoot, "data", "organizations", "registration-requests.json");
const therapistProfilesPath = join(
  projectRoot,
  "data",
  "therapists",
  "registration-profiles.json",
);

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = join(projectRoot, "data", "cleanup-backups", timestamp);

function readJsonArray<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function backupFile(path: string): void {
  if (!existsSync(path)) return;
  mkdirSync(backupDir, { recursive: true });
  const rel = path.replace(projectRoot, "").replace(/^[\\/]/, "").replace(/[\\/]/g, "__");
  copyFileSync(path, join(backupDir, rel));
}

function writeJsonArray<T>(path: string, items: T[]): void {
  writeFileSync(path, JSON.stringify(items, null, 2), "utf8");
}

// ──────────── 대상 식별 ────────────

type ManualOrg = {
  id: string;
  name: string;
  address?: string;
};
type OrgRequest = {
  id: string;
  organizationName: string;
  status: "pending" | "approved" | "rejected";
};
type TherapistProfile = {
  userId: string;
  therapistName: string;
  organizationId?: string;
  requestedOrganizationName?: string;
};

async function main() {
  console.log(`[cleanup] 대상 기관 이름: ${[...TARGET_ORG_NAMES].join(", ")}`);
  console.log(`[cleanup] 모드: ${apply ? "APPLY (실제 삭제)" : "DRY-RUN (확인만)"}`);
  console.log(
    `[cleanup] 고아 치료사 정리: ${wipeOrphans ? "ON (--wipe-orphan-therapists)" : "OFF"}`,
  );
  console.log("");

  const manualOrgs = readJsonArray<ManualOrg>(manualOrgsPath);
  const orgRequests = readJsonArray<OrgRequest>(orgRequestsPath);
  const therapistProfiles = readJsonArray<TherapistProfile>(therapistProfilesPath);

  // 1. 삭제 대상 manual-organizations 식별
  const targetOrgs = manualOrgs.filter((o) => TARGET_ORG_NAMES.has(o.name));
  const targetOrgIds = new Set(targetOrgs.map((o) => o.id));
  const keepOrgs = manualOrgs.filter((o) => !TARGET_ORG_NAMES.has(o.name));

  // 2. 삭제 대상 등록 요청 식별 (같은 기관 이름)
  const targetRequests = orgRequests.filter((r) => TARGET_ORG_NAMES.has(r.organizationName));
  const keepRequests = orgRequests.filter((r) => !TARGET_ORG_NAMES.has(r.organizationName));

  // 3. 삭제 대상 치료사 프로필 식별
  //    - organizationId 가 target org id 중 하나이거나
  //    - requestedOrganizationName 이 target 이름 중 하나
  const targetTherapistProfiles = therapistProfiles.filter((p) => {
    if (p.organizationId && targetOrgIds.has(p.organizationId)) return true;
    if (
      p.requestedOrganizationName &&
      TARGET_ORG_NAMES.has(p.requestedOrganizationName)
    ) {
      return true;
    }
    return false;
  });
  const keepTherapistProfiles = therapistProfiles.filter(
    (p) => !targetTherapistProfiles.includes(p),
  );
  const targetUserIdsFromJson = targetTherapistProfiles.map((p) => p.userId);

  // DB 직접 조회 — JSON과 동기화가 깨진 경우를 대비한 보조 경로.
  // organization_id 가 삭제 대상 기관 id 중 하나인 therapist 행을 전부 찾는다.
  const dbProbePool = new Pool({ connectionString: dbUrl });
  const dbProbe = await dbProbePool.connect();
  let dbOnlyUserIds: string[] = [];
  let orphanUserIds: { userId: string; loginId: string }[] = [];
  try {
    const hasOrgCol = await dbProbe.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = 'app_users'
         AND column_name = 'organization_id'
       LIMIT 1`,
    );
    if (hasOrgCol.rowCount && targetOrgIds.size > 0) {
      const orgIdArr = [...targetOrgIds];
      const result = await dbProbe.query<{ user_id: string }>(
        `SELECT user_id::text AS user_id
           FROM app_users
          WHERE user_role = 'therapist'
            AND organization_id = ANY($1::uuid[])`,
        [orgIdArr],
      );
      const jsonSet = new Set(targetUserIdsFromJson);
      dbOnlyUserIds = result.rows
        .map((r) => r.user_id)
        .filter((id) => !jsonSet.has(id));
    }

    // --wipe-orphan-therapists 플래그가 켜진 경우에만 organization_id 가
    // NULL 인 치료사를 전부 고아로 간주하고 수집한다. 타겟 기관 이름과는
    // 무관하게 동작하므로, 승인 전 누락된 테스트 계정 정리에 쓴다.
    if (hasOrgCol.rowCount && wipeOrphans) {
      const orphanResult = await dbProbe.query<{
        user_id: string;
        login_id: string;
      }>(
        `SELECT user_id::text AS user_id, login_id
           FROM app_users
          WHERE user_role = 'therapist'
            AND organization_id IS NULL`,
      );
      orphanUserIds = orphanResult.rows.map((r) => ({
        userId: r.user_id,
        loginId: r.login_id,
      }));
    }
  } finally {
    dbProbe.release();
    await dbProbePool.end();
  }

  const allTargetUserIds = Array.from(
    new Set<string>([
      ...targetUserIdsFromJson,
      ...dbOnlyUserIds,
      ...orphanUserIds.map((o) => o.userId),
    ]),
  );

  // wipeOrphans 모드에서 혹시 JSON 프로필에 orphan userId 가 남아있으면
  // 그것도 같이 정리한다. 보통은 고아 = JSON 에도 없는 상태지만, 과거
  // 불완전 가입 흔적이 남아있을 수 있어 defensive 하게 제외한다.
  const orphanUserIdSet = new Set(orphanUserIds.map((o) => o.userId));
  const finalKeepTherapistProfiles =
    wipeOrphans && orphanUserIdSet.size > 0
      ? keepTherapistProfiles.filter((p) => !orphanUserIdSet.has(p.userId))
      : keepTherapistProfiles;

  console.log("[cleanup] manual-organizations.json");
  console.log(`  삭제: ${targetOrgs.length}건`);
  for (const o of targetOrgs) console.log(`    - ${o.name} (id=${o.id.slice(0, 8)}...)`);
  console.log(`  유지: ${keepOrgs.length}건`);
  console.log("");

  console.log("[cleanup] registration-requests.json");
  console.log(`  삭제: ${targetRequests.length}건`);
  for (const r of targetRequests)
    console.log(`    - ${r.organizationName} (status=${r.status})`);
  console.log(`  유지: ${keepRequests.length}건`);
  console.log("");

  console.log("[cleanup] therapist registration-profiles.json");
  console.log(`  삭제: ${targetTherapistProfiles.length}건`);
  for (const p of targetTherapistProfiles)
    console.log(
      `    - ${p.therapistName} (userId=${p.userId.slice(0, 8)}..., org=${
        p.organizationId ? p.organizationId.slice(0, 8) + "..." : p.requestedOrganizationName
      })`,
    );
  if (wipeOrphans) {
    const extraRemoved = keepTherapistProfiles.length - finalKeepTherapistProfiles.length;
    if (extraRemoved > 0) {
      console.log(`  추가 삭제(orphan 매칭): ${extraRemoved}건`);
    }
  }
  console.log(`  유지: ${finalKeepTherapistProfiles.length}건`);
  console.log("");

  console.log("[cleanup] DB app_users 삭제 대상");
  console.log(`  JSON 프로필 기준: ${targetUserIdsFromJson.length}건`);
  console.log(`  DB-only 고아(organization_id 매칭): ${dbOnlyUserIds.length}건`);
  for (const id of dbOnlyUserIds) console.log(`    - ${id.slice(0, 8)}...`);
  if (wipeOrphans) {
    console.log(`  organization_id NULL 고아: ${orphanUserIds.length}건`);
    for (const o of orphanUserIds)
      console.log(`    - ${o.loginId} (${o.userId.slice(0, 8)}...)`);
  }
  console.log(`  합계: ${allTargetUserIds.length}건`);

  if (!apply) {
    console.log("");
    console.log("드라이런 완료. 실제 삭제하려면 --yes 플래그를 붙여 다시 실행하세요.");
    process.exit(0);
  }

  // ──────────── 실제 적용 ────────────

  // JSON 백업
  backupFile(manualOrgsPath);
  backupFile(orgRequestsPath);
  backupFile(therapistProfilesPath);
  console.log(`[cleanup] JSON 백업 디렉터리: ${backupDir}`);

  // JSON 쓰기
  writeJsonArray(manualOrgsPath, keepOrgs);
  writeJsonArray(orgRequestsPath, keepRequests);
  writeJsonArray(therapistProfilesPath, finalKeepTherapistProfiles);
  console.log("[cleanup] JSON 파일 업데이트 완료");

  // DB 트랜잭션
  if (allTargetUserIds.length === 0) {
    console.log("[cleanup] DB 작업 대상 없음");
    return;
  }

  const pool = new Pool({ connectionString: dbUrl });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 관련 FK 테이블 정리 (존재 여부 defensive)
    const relatedTables: { table: string; column: string }[] = [
      { table: "therapist_patient_assignments", column: "therapist_user_id" },
      { table: "patient_link_requests", column: "therapist_user_id" },
      { table: "patient_link_requests", column: "reviewed_by" },
    ];
    for (const { table, column } of relatedTables) {
      const exists = await client.query(
        `
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2
          LIMIT 1
        `,
        [table, column],
      );
      if (!exists.rowCount) continue;
      const result = await client.query(
        `DELETE FROM ${table} WHERE ${column} = ANY($1::uuid[])`,
        [allTargetUserIds],
      );
      console.log(`  - ${table}.${column}: ${result.rowCount ?? 0} 행 삭제`);
    }

    // app_users 삭제 (마지막)
    const userDelete = await client.query(
      `DELETE FROM app_users WHERE user_id = ANY($1::uuid[]) AND user_role = 'therapist' RETURNING user_id`,
      [allTargetUserIds],
    );
    console.log(`  - app_users (therapist): ${userDelete.rowCount ?? 0} 행 삭제`);

    await client.query("COMMIT");
    console.log("[cleanup] DB COMMIT 완료");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[cleanup] DB 작업 실패, ROLLBACK:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }

  console.log("");
  console.log("[cleanup] 모든 정리 완료.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
