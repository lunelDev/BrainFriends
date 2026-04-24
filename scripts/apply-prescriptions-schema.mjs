/**
 * BrainFriends: 처방(Prescriptions) 스키마 적용 스크립트
 *
 * 용도
 *   docs/database/prescriptions.sql 을 로컬 brainfriends_dev 에 적용한다.
 *   멱등(CREATE TABLE IF NOT EXISTS) 이라 여러 번 돌려도 안전.
 *
 * 사용법
 *   node scripts/apply-prescriptions-schema.mjs --yes
 *
 * 안전장치 (seed-cus01 과 동일 4중)
 *   1) DATABASE_URL host 가 localhost/127.0.0.1 이 아니면 즉시 종료
 *   2) DB 이름이 dev 화이트리스트가 아니면 거부
 *   3) NODE_ENV=production 이면 거부
 *   4) --yes 없으면 드라이런(출력만)
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
  console.error(`[apply-prescriptions-schema] ABORT: ${msg}`);
  process.exit(1);
}

if (process.env.NODE_ENV === "production") {
  fail("NODE_ENV=production 에서는 실행 불가");
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) fail("DATABASE_URL 이 설정되지 않음");

let parsedUrl;
try {
  parsedUrl = new URL(dbUrl);
} catch {
  fail("DATABASE_URL 을 URL 로 파싱할 수 없음");
}

const host = parsedUrl.hostname;
if (host !== "localhost" && host !== "127.0.0.1") {
  fail(`host=${host} — 로컬 호스트가 아니면 거부`);
}

const dbName = parsedUrl.pathname.replace(/^\//, "");
if (!DEV_DB_WHITELIST.has(dbName) && !allowNonDevDb) {
  fail(`db=${dbName} — dev 화이트리스트에 없음. 꼭 필요하면 ALLOW_NON_DEV_DB=1`);
}

const sqlPath = join(projectRoot, "docs", "database", "prescriptions.sql");
if (!existsSync(sqlPath)) fail(`SQL 파일을 찾을 수 없음: ${sqlPath}`);
const sql = readFileSync(sqlPath, "utf8");

console.log("[apply-prescriptions-schema]");
console.log(`  host=${host}  db=${dbName}`);
console.log(`  sql=${sqlPath}  (${sql.length} bytes)`);

if (!isApply) {
  console.log("\nDRY RUN. 실제로 적용하려면 --yes 를 붙여라.");
  process.exit(0);
}

const client = new Client({ connectionString: dbUrl });
try {
  await client.connect();
  await client.query(sql);
  const { rows } = await client.query(
    `SELECT tablename FROM pg_tables
      WHERE schemaname='public'
        AND tablename IN ('prescriptions','prescription_sessions')
      ORDER BY tablename`,
  );
  console.log("\n적용 완료. 확인된 테이블:");
  for (const r of rows) console.log(`  - ${r.tablename}`);
} catch (err) {
  console.error("[apply-prescriptions-schema] ERROR:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
