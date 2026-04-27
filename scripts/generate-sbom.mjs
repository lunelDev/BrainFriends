/**
 * SBOM (Software Bill of Materials) 생성 스크립트.
 *
 * 표준: CycloneDX 1.5 (식약처 사이버보안 가이드라인 권고).
 * 외부 의존 없이 package.json + package-lock.json 만 읽어 생성한다.
 * (cyclonedx-npm 패키지 도입 전 단계의 경량 폴백)
 *
 * 출력: docs/security/sbom/sbom-YYYYMMDD-HHmmss.json (+ latest.json)
 *
 * 사용:
 *   npm run security:sbom
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const outDir = join(projectRoot, "docs", "security", "sbom");
mkdirSync(outDir, { recursive: true });

const pkg = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));
const lockPath = join(projectRoot, "package-lock.json");
if (!existsSync(lockPath)) {
  console.error("[sbom] package-lock.json 없음. `npm install` 먼저 실행해라.");
  process.exit(1);
}
const lock = JSON.parse(readFileSync(lockPath, "utf8"));

function purl(name, version) {
  // Package URL spec: pkg:npm/<name>@<version>
  const safeName = name.startsWith("@")
    ? name.replace("/", "%2F")
    : encodeURIComponent(name);
  return `pkg:npm/${safeName}@${encodeURIComponent(version)}`;
}

const components = [];
const seen = new Set();

function walk(packages) {
  if (!packages) return;
  for (const [path, info] of Object.entries(packages)) {
    if (!path) continue; // root entry ""
    if (!info || typeof info !== "object") continue;
    const name = info.name || path.split("node_modules/").pop();
    const version = info.version;
    if (!name || !version) continue;
    const key = `${name}@${version}`;
    if (seen.has(key)) continue;
    seen.add(key);
    components.push({
      "bom-ref": key,
      type: "library",
      name,
      version,
      purl: purl(name, version),
      scope: info.dev ? "optional" : "required",
      ...(info.license ? { licenses: [{ license: { id: String(info.license) } }] } : {}),
    });
  }
}
walk(lock.packages);

const now = new Date();
const stamp = now
  .toISOString()
  .replace(/[-:T]/g, "")
  .replace(/\.\d+Z$/, "");

const sbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  serialNumber: `urn:uuid:${randomUUID()}`,
  version: 1,
  metadata: {
    timestamp: now.toISOString(),
    tools: [{ vendor: "brainfriends", name: "generate-sbom.mjs", version: "0.1" }],
    component: {
      "bom-ref": `${pkg.name}@${pkg.version}`,
      type: "application",
      name: pkg.name,
      version: pkg.version,
      purl: purl(pkg.name, pkg.version),
    },
  },
  components,
};

const outPath = join(outDir, `sbom-${stamp}.json`);
const latestPath = join(outDir, "latest.json");
writeFileSync(outPath, JSON.stringify(sbom, null, 2), "utf8");
writeFileSync(latestPath, JSON.stringify(sbom, null, 2), "utf8");

console.log(`[sbom] components=${components.length}`);
console.log(`[sbom] wrote ${outPath}`);
console.log(`[sbom] wrote ${latestPath}`);
