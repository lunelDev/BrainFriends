/**
 * scripts/apply-2fa-schema.mjs
 *
 * docs/database/user_2fa.sql 을 로컬 brainfriends_dev 에 적용한다.
 * apply-prescriptions-schema.mjs 와 동일한 4중 안전장치.
 *
 * 사용:
 *   node scripts/apply-2fa-schema.mjs --yes
 */

import { Client } from "pg";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

function loadEnvLocal() {
  const envPath = join(projectRoot, ".env.local");
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnvLocal();

const DEV_DB_WHITELIST = new Set([
  "brainfriends_dev",
  "brainfriends_local",
  "brainfriends_test",
]);

const args = new Set(process.argv.slice(2));
const isApply = args.has("--yes");
const allowNonDevDb = process.env.ALLOW_NON_DEV_DB === "1";

function fail(msg) {
  console.error(`[apply-2fa-schema] ABORT: ${msg}`);
  process.exit(1);
}

if (process.env.NODE_ENV === "production") fail("production 환경 거부");
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) fail("DATABASE_URL 미설정");
let parsedUrl;
try {
  parsedUrl = new URL(dbUrl);
} catch {
  fail("DATABASE_URL 파싱 실패");
}
const host = parsedUrl.hostname;
if (host !== "localhost" && host !== "127.0.0.1") fail(`host=${host} 비로컬`);
const dbName = parsedUrl.pathname.replace(/^\//, "");
if (!DEV_DB_WHITELIST.has(dbName) && !allowNonDevDb) fail(`db=${dbName} 비dev`);

const sqlPath = join(projectRoot, "docs", "database", "user_2fa.sql");
if (!existsSync(sqlPath)) fail(`SQL 누락: ${sqlPath}`);
const sql = readFileSync(sqlPath, "utf8");

console.log(`[apply-2fa-schema] host=${host} db=${dbName} sql=${sqlPath}`);
if (!isApply) {
  console.log("DRY RUN. --yes 로 실제 적용.");
  process.exit(0);
}

const client = new Client({ connectionString: dbUrl });
try {
  await client.connect();
  await client.query(sql);
  const { rows } = await client.query(
    `SELECT tablename FROM pg_tables
      WHERE schemaname='public' AND tablename = 'user_2fa_totp'`,
  );
  console.log("적용 완료. 테이블:", rows.map((r) => r.tablename));
} catch (err) {
  console.error("ERROR:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
