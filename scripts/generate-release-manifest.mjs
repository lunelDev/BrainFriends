/**
 * Release Manifest 자동 생성.
 *
 * 식약처 디지털의료기기 사이버보안 가이드라인 SI-04 + GMP [별표3] 2.3 형상관리.
 * SR-SEC-SI04-MANIFEST 의 빌드 시점 산출 단계.
 *
 * 입력 (자동 수집):
 *   - git SHA (HEAD)
 *   - package-lock.json sha256
 *   - voice-analysis-service/requirements.txt sha256 (선택)
 *   - docs/security/sbom/latest.json sha256 (선택)
 *   - docs/security/soup/latest.json sha256 (선택)
 *   - public/face_landmarker.task sha256 (선택, 모델 자산)
 *
 * 출력:
 *   - docs/security/manifest/release-manifest-YYYYMMDD-HHmmss.json
 *   - docs/security/manifest/latest.json
 *   - docs/security/manifest/latest.md (양식 문서용)
 *
 * 결정성: 동일 입력 → 동일 manifestHash. 생성 시각만 기록 (검증에는 미포함).
 *
 * 사용:
 *   npm run security:manifest
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const outDir = join(projectRoot, "docs", "security", "manifest");
mkdirSync(outDir, { recursive: true });

function sha256Hex(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function fileSha256(absPath) {
  if (!existsSync(absPath)) return null;
  const buf = readFileSync(absPath);
  return sha256Hex(buf);
}

function gitSha() {
  try {
    return execSync("git rev-parse HEAD", { cwd: projectRoot }).toString().trim();
  } catch {
    return null;
  }
}

function gitDirty() {
  try {
    const out = execSync("git status --porcelain", { cwd: projectRoot }).toString().trim();
    return out.length > 0;
  } catch {
    return null;
  }
}

const pkg = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));

// ─────────────────────────────────────────────────────────────────
// 1) 형상요소 수집
// ─────────────────────────────────────────────────────────────────
const components = [];

// 1-a) git SHA — 코드 base
const sha = gitSha();
const dirty = gitDirty();
if (sha) {
  // git SHA 자체를 sha256 hex 로 변환해서 동일 형식으로 통일.
  const ghash = sha256Hex(Buffer.from(sha, "utf8"));
  components.push({
    id: "git-sha",
    description: "Git HEAD commit (코드 base)",
    sha256: ghash,
    meta: {
      gitSha: sha,
      dirty: dirty === true,
    },
  });
}

// 1-b) package-lock.json
const lockPath = join(projectRoot, "package-lock.json");
const lockSha = fileSha256(lockPath);
if (lockSha) {
  components.push({
    id: "package-lock",
    description: "npm 의존성 lock (정확한 트리)",
    sha256: lockSha,
    meta: {
      path: "package-lock.json",
    },
  });
}

// 1-c) voice-analysis-service/requirements.txt
const pyReq = join(projectRoot, "voice-analysis-service", "requirements.txt");
const pySha = fileSha256(pyReq);
if (pySha) {
  components.push({
    id: "python-requirements",
    description: "voice-analysis-service Python 의존성 동결",
    sha256: pySha,
    meta: {
      path: "voice-analysis-service/requirements.txt",
    },
  });
}

// 1-d) SBOM
const sbom = join(projectRoot, "docs", "security", "sbom", "latest.json");
const sbomSha = fileSha256(sbom);
if (sbomSha) {
  components.push({
    id: "sbom",
    description: "SBOM (CycloneDX, npm 트리)",
    sha256: sbomSha,
    meta: {
      path: "docs/security/sbom/latest.json",
    },
  });
}

// 1-e) SOUP
const soup = join(projectRoot, "docs", "security", "soup", "latest.json");
const soupSha = fileSha256(soup);
if (soupSha) {
  components.push({
    id: "soup",
    description: "SOUP 목록 (npm + pypi + model)",
    sha256: soupSha,
    meta: {
      path: "docs/security/soup/latest.json",
    },
  });
}

// 1-f) 모델 자산 — MediaPipe face_landmarker.task
const candidates = [
  "public/face_landmarker.task",
  "public/models/face_landmarker.task",
];
for (const rel of candidates) {
  const abs = join(projectRoot, rel);
  const s = fileSha256(abs);
  if (s) {
    components.push({
      id: `model-asset-${rel.replace(/[^A-Za-z0-9]/g, "_")}`,
      description: `로컬 모델 자산: ${rel}`,
      sha256: s,
      meta: { path: rel },
    });
    break;
  }
}

if (components.length === 0) {
  console.error("[manifest] 수집된 형상요소가 없다. git/lock/sbom/soup 중 최소 1개 필요.");
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────
// 2) 정규화 + manifestHash 계산
// ─────────────────────────────────────────────────────────────────
function normalizeComponents(list) {
  const map = new Map();
  for (const raw of list) {
    const id = String(raw.id || "").trim();
    if (!id) continue;
    const sha = String(raw.sha256 || "").trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(sha)) {
      throw new Error(`[manifest] invalid sha256 for ${id}`);
    }
    const norm = {
      id,
      description: String(raw.description || "").trim(),
      sha256: sha,
    };
    if (raw.meta && Object.keys(raw.meta).length > 0) {
      const sortedMeta = {};
      for (const key of Object.keys(raw.meta).sort()) {
        sortedMeta[key] = raw.meta[key] ?? null;
      }
      norm.meta = sortedMeta;
    }
    map.set(id, norm);
  }
  const arr = Array.from(map.values());
  arr.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return arr;
}

function computeManifestHash(comps) {
  const lines = comps.map((c) => `${c.id}|${c.sha256}`);
  return sha256Hex(Buffer.from(lines.join("\n"), "utf8"));
}

const norm = normalizeComponents(components);
const manifestHash = computeManifestHash(norm);

// ─────────────────────────────────────────────────────────────────
// 3) 출력
// ─────────────────────────────────────────────────────────────────
const generatedAt = new Date().toISOString();
const stamp = generatedAt.replace(/[:.]/g, "").slice(0, 15);

const manifest = {
  manifestVersion: 1,
  productName: pkg.name,
  productVersion: pkg.version,
  manifestHash,
  components: norm,
};

// JSON 직렬화 (lib/server/releaseManifest.ts 의 serializeManifest 와 동일 형태).
const json = JSON.stringify(manifest, null, 2) + "\n";

const outPath = join(outDir, `release-manifest-${stamp}.json`);
const latestPath = join(outDir, "latest.json");
writeFileSync(outPath, json, "utf8");
writeFileSync(latestPath, json, "utf8");

const md = [
  `# Release Manifest (BrainFriends)`,
  ``,
  `생성: ${generatedAt}`,
  `제품: ${pkg.name} ${pkg.version}`,
  `Manifest Hash (SHA-256): \`${manifestHash}\``,
  ``,
  `## 형상요소 (${norm.length}개)`,
  ``,
  `| ID | 설명 | SHA-256 (앞 16자) | 메타 |`,
  `|---|---|---|---|`,
  ...norm.map((c) => {
    const metaStr = c.meta ? Object.entries(c.meta).map(([k, v]) => `${k}=${v}`).join(", ") : "-";
    return `| ${c.id} | ${c.description} | \`${c.sha256.slice(0, 16)}…\` | ${metaStr} |`;
  }),
  ``,
  `## 검증`,
  ``,
  `- 서버 시작 시 \`verifyManifest\` (src/lib/server/releaseManifest.ts) 가 위 manifestHash 를 재계산해 일치 여부 확인`,
  `- 불일치 (sha 변조 / version 불일치 / 누락 / 추가) 시 audit log 기록 + 정책에 따라 시작 차단`,
  `- 본 manifest 자체의 무결성은 \`manifestHash\` 와 components 배열의 결정성 정렬로 보장`,
  ``,
].join("\n");
writeFileSync(join(outDir, "latest.md"), md, "utf8");

console.log(`[manifest] generated ${norm.length} components → ${outPath}`);
console.log(`[manifest] manifestHash = ${manifestHash}`);
if (dirty === true) {
  console.warn(`[manifest] WARNING: working tree is dirty (uncommitted changes). Manifest 는 commit 후 재생성 권장.`);
}
