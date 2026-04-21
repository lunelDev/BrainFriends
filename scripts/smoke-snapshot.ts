/**
 * BrainFriends 회귀 감지용 스모크 스냅샷
 *
 * 사용법:
 *   npx tsx scripts/smoke-snapshot.ts            # 새 스냅샷 저장 + 직전 스냅샷과 자동 비교
 *   npx tsx scripts/smoke-snapshot.ts --no-save  # 비교만, 저장 안 함
 *   npx tsx scripts/smoke-snapshot.ts --baseline # 새 스냅샷 저장 + 비교 안 함 (기준점 만들기)
 *
 * 동작:
 *   - 로컬 DB에 접속하여 핵심 테이블 행 수와 샘플 쿼리 결과를 JSON 으로 저장
 *   - data/smoke-snapshots/YYYYMMDD_HHMMSS.json
 *   - 직전 스냅샷과 비교하여 변경된 항목만 출력
 *
 * 안전장치:
 *   - localhost 가 아니면 거부
 *   - 어떤 테이블 변경도 하지 않음 (전부 SELECT)
 *
 * 변경 후 깨졌는지 확인하는 절차:
 *   1) 변경 전:  npx tsx scripts/smoke-snapshot.ts --baseline
 *   2) 변경 적용
 *   3) 변경 후:  npx tsx scripts/smoke-snapshot.ts
 *      → 변경된 항목과 새로 생긴 오류가 표시됨
 */

import { Pool } from "pg";
import { mkdirSync, writeFileSync, readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const snapshotDir = join(projectRoot, "data", "smoke-snapshots");

// .env.local 을 간단 파서로 읽어서 process.env 에 주입
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
  console.error("DATABASE_URL 이 .env.local 에 없음");
  process.exit(1);
}
const hostMatch = dbUrl.match(/@([^:\/]+)(:\d+)?\//);
const host = hostMatch?.[1] ?? "(unknown)";
if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
  console.error(`로컬 DB 가 아닙니다 (host=${host}). 작업 중단.`);
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const noSave = args.has("--no-save");
const baseline = args.has("--baseline");

// ──────────── 점검 항목 ────────────

type Check = {
  name: string;
  sql: string;
  /** 결과 행을 비교 가능한 문자열로 정규화 */
  normalize?: (rows: unknown[]) => unknown;
};

const CHECKS: Check[] = [
  // 레거시 신원 계층
  { name: "app_users.count", sql: "SELECT count(*)::int AS n FROM app_users" },
  { name: "patient_pii.count", sql: "SELECT count(*)::int AS n FROM patient_pii" },
  {
    name: "patient_intake_profiles.count",
    sql: "SELECT count(*)::int AS n FROM patient_intake_profiles",
  },
  { name: "organizations.count", sql: "SELECT count(*)::int AS n FROM organizations" },
  {
    name: "therapist_patient_assignments.count",
    sql: "SELECT count(*)::int AS n FROM therapist_patient_assignments",
  },
  { name: "auth_sessions.count", sql: "SELECT count(*)::int AS n FROM auth_sessions" },
  {
    name: "patient_pseudonym_map.count",
    sql: "SELECT count(*)::int AS n FROM patient_pseudonym_map",
  },

  // 임상 계층
  { name: "clinical_sessions.count", sql: "SELECT count(*)::int AS n FROM clinical_sessions" },
  {
    name: "language_training_results.count",
    sql: "SELECT count(*)::int AS n FROM language_training_results",
  },
  { name: "sing_results.count", sql: "SELECT count(*)::int AS n FROM sing_results" },
  {
    name: "clinical_media_objects.count",
    sql: "SELECT count(*)::int AS n FROM clinical_media_objects",
  },

  // 운영
  {
    name: "training_client_drafts.count",
    sql: "SELECT count(*)::int AS n FROM training_client_drafts",
  },
  {
    name: "training_usage_events.count",
    sql: "SELECT count(*)::int AS n FROM training_usage_events",
  },

  // 신규 (있으면 비교, 없으면 안전하게 무시)
  {
    name: "users.count",
    sql: "SELECT count(*)::int AS n FROM users",
  },
  {
    name: "user_pii_profile.count",
    sql: "SELECT count(*)::int AS n FROM user_pii_profile",
  },
  {
    name: "therapist_profiles.count",
    sql: "SELECT count(*)::int AS n FROM therapist_profiles",
  },
  {
    name: "institutions.count",
    sql: "SELECT count(*)::int AS n FROM institutions",
  },
  {
    name: "institution_members.count",
    sql: "SELECT count(*)::int AS n FROM institution_members",
  },
  {
    name: "user_therapist_mappings.count",
    sql: "SELECT count(*)::int AS n FROM user_therapist_mappings",
  },
  {
    name: "clinical_patient_profiles.count",
    sql: "SELECT count(*)::int AS n FROM clinical_patient_profiles",
  },

  // 핵심 분포
  {
    name: "app_users.role_distribution",
    sql: "SELECT user_role, count(*)::int AS n FROM app_users GROUP BY user_role ORDER BY user_role",
  },
  {
    name: "app_users.approval_distribution",
    sql:
      "SELECT COALESCE(approval_state,'(null)') AS approval_state, count(*)::int AS n " +
      "FROM app_users GROUP BY approval_state ORDER BY approval_state",
  },
  {
    name: "users.account_type_distribution",
    sql:
      "SELECT account_type, status, count(*)::int AS n " +
      "FROM users GROUP BY account_type, status ORDER BY account_type, status",
  },

  // 핵심 쿼리 동작 확인 (행 수만)
  {
    name: "session_join_smoke",
    sql: `
      SELECT count(*)::int AS n
        FROM auth_sessions s
        JOIN app_users u ON u.user_id = s.user_id
       WHERE s.expires_at > NOW()
    `,
  },
  {
    name: "active_admin_exists",
    sql:
      "SELECT count(*)::int AS n FROM app_users " +
      "WHERE user_role = 'admin'",
  },
];

// ──────────── 실행 ────────────

async function takeSnapshot(): Promise<Record<string, unknown>> {
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: process.env.DATABASE_SSL === "require" ? { rejectUnauthorized: false } : false,
  });

  const out: Record<string, unknown> = {
    capturedAt: new Date().toISOString(),
    host,
    results: {} as Record<string, unknown>,
  };

  const results = out.results as Record<string, unknown>;

  for (const check of CHECKS) {
    try {
      const r = await pool.query(check.sql);
      results[check.name] = check.normalize ? check.normalize(r.rows) : r.rows;
    } catch (err) {
      results[check.name] = {
        __error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  await pool.end();
  return out;
}

function loadLatestSnapshot(): { path: string; data: Record<string, unknown> } | null {
  if (!existsSync(snapshotDir)) return null;
  const files = readdirSync(snapshotDir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  if (!files.length) return null;
  const last = files[files.length - 1];
  const fullPath = join(snapshotDir, last);
  const data = JSON.parse(readFileSync(fullPath, "utf8")) as Record<string, unknown>;
  return { path: fullPath, data };
}

function diffSnapshots(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
): string[] {
  const lines: string[] = [];
  const a = (prev.results ?? {}) as Record<string, unknown>;
  const b = (next.results ?? {}) as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of [...keys].sort()) {
    const va = JSON.stringify(a[key]);
    const vb = JSON.stringify(b[key]);
    if (va !== vb) {
      lines.push(`  ${key}`);
      lines.push(`    이전: ${va ?? "(없음)"}`);
      lines.push(`    이후: ${vb ?? "(없음)"}`);
    }
  }
  return lines;
}

async function main(): Promise<void> {
  console.log(`■ 스모크 스냅샷 (host=${host})`);
  const next = await takeSnapshot();

  const errs = Object.entries((next.results as Record<string, unknown>) ?? {}).filter(
    ([, v]) => typeof v === "object" && v !== null && "__error" in (v as object),
  );

  if (errs.length) {
    console.log("");
    console.log("■ 오류 항목 (해당 테이블이 아직 없을 수도 있음 — 마이그 전이면 정상):");
    for (const [k, v] of errs) {
      console.log(`  - ${k}: ${(v as { __error: string }).__error}`);
    }
  }

  const prev = loadLatestSnapshot();

  if (!noSave) {
    mkdirSync(snapshotDir, { recursive: true });
    const ts = next.capturedAt as string;
    const filename = `${ts.replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "_")}.json`;
    const fullPath = join(snapshotDir, filename);
    writeFileSync(fullPath, JSON.stringify(next, null, 2), "utf8");
    console.log("");
    console.log(`■ 새 스냅샷 저장: ${fullPath}`);
  }

  if (baseline) {
    console.log("■ baseline 모드 — 비교 생략");
    return;
  }

  if (!prev) {
    console.log("■ 직전 스냅샷이 없어 비교 생략");
    return;
  }

  const diff = diffSnapshots(prev.data, next);
  console.log("");
  console.log(`■ 직전 스냅샷과 비교: ${prev.path}`);
  if (!diff.length) {
    console.log("  변화 없음 ✓");
  } else {
    console.log("  변화 감지:");
    for (const line of diff) console.log(line);
  }
}

main().catch((err) => {
  console.error("실패:", err);
  process.exit(1);
});
