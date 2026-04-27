/**
 * npm audit 게이트.
 *
 * 정책:
 *   - critical / high 가 1건이라도 있으면 EXIT 1
 *   - moderate / low 는 보고만 하고 통과
 *   - 결과 JSON 보존: docs/security/audit/audit-YYYYMMDD-HHmmss.json (+ latest.json)
 *
 * 사용:
 *   npm run security:audit
 *   CI 에서 이 스크립트를 게이트로 걸어 두면 위험 의존성이 머지 차단된다.
 */

import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const outDir = join(projectRoot, "docs", "security", "audit");
mkdirSync(outDir, { recursive: true });

const allowSeverity = process.env.AUDIT_FAIL_LEVEL || "high";
const blockedSeverities = new Set(
  allowSeverity === "critical"
    ? ["critical"]
    : allowSeverity === "high"
      ? ["critical", "high"]
      : ["critical", "high", "moderate"],
);

const result = spawnSync("npm", ["audit", "--json", "--omit=dev"], {
  cwd: projectRoot,
  encoding: "utf8",
  maxBuffer: 50 * 1024 * 1024,
});

if (!result.stdout) {
  console.error("[audit] npm audit 실행 실패:", result.stderr);
  process.exit(2);
}

let parsed;
try {
  parsed = JSON.parse(result.stdout);
} catch (err) {
  console.error("[audit] JSON 파싱 실패:", err.message);
  process.exit(2);
}

const now = new Date();
const stamp = now
  .toISOString()
  .replace(/[-:T]/g, "")
  .replace(/\.\d+Z$/, "");
const outPath = join(outDir, `audit-${stamp}.json`);
const latestPath = join(outDir, "latest.json");
writeFileSync(outPath, JSON.stringify(parsed, null, 2), "utf8");
writeFileSync(latestPath, JSON.stringify(parsed, null, 2), "utf8");

const meta = parsed.metadata?.vulnerabilities || {};
const counts = {
  critical: meta.critical || 0,
  high: meta.high || 0,
  moderate: meta.moderate || 0,
  low: meta.low || 0,
  info: meta.info || 0,
};

console.log("[audit] vulnerabilities:");
for (const [k, v] of Object.entries(counts)) {
  console.log(`  ${k.padEnd(10)} ${v}`);
}
console.log(`[audit] saved ${outPath}`);
console.log(`[audit] block level=${allowSeverity}`);

const blocked = Object.entries(counts)
  .filter(([sev, count]) => count > 0 && blockedSeverities.has(sev))
  .map(([sev, count]) => `${sev}=${count}`);

if (blocked.length) {
  console.error(
    `\n[audit] FAIL — ${blocked.join(", ")} 취약점 발견. 의존성 업데이트 또는 면제 사유 기록 후 재실행.`,
  );
  process.exit(1);
}

console.log("\n[audit] PASS — 차단 등급 취약점 없음.");
