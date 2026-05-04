/**
 * SOUP (Software of Unknown Provenance) 목록 자동 생성.
 *
 * 식약처 디지털의료기기 GMP [별표3] 2.3 형상관리 / IEC 62304 SOUP 요건 대응.
 * SI-04 의 일부 산출물.
 *
 * 입력:
 *   - package.json + package-lock.json (Node 의존성)
 *   - voice-analysis-service/requirements.txt (Python 의존성, 존재 시)
 *   - 알려진 외부 AI 모델 (코드 내 상수)
 *
 * 출력:
 *   - docs/security/soup/soup-list-YYYYMMDD-HHmmss.json
 *   - docs/security/soup/latest.json
 *   - docs/security/soup/latest.md (양식 문서용)
 *
 * 결정성: 동일 입력 → 동일 출력 (생성 시각 제외).
 *
 * 사용:
 *   npm run security:soup
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const outDir = join(projectRoot, "docs", "security", "soup");
mkdirSync(outDir, { recursive: true });

// ─────────────────────────────────────────────────────────────────
// 1) Node (npm) 의존성
// ─────────────────────────────────────────────────────────────────
const pkg = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));
const lockPath = join(projectRoot, "package-lock.json");
if (!existsSync(lockPath)) {
  console.error("[soup] package-lock.json 없음. `npm install` 먼저 실행해라.");
  process.exit(1);
}
const lock = JSON.parse(readFileSync(lockPath, "utf8"));

const npmEntries = [];
for (const name of Object.keys(pkg.dependencies ?? {})) {
  // package-lock.json 에서 실제 설치된 버전 조회
  const lockEntry = lock.packages?.[`node_modules/${name}`];
  if (!lockEntry) continue;
  npmEntries.push({
    name,
    version: lockEntry.version || pkg.dependencies[name],
    license: lockEntry.license || null,
    sourceType: "npm",
    purpose: deriveNpmPurpose(name),
    riskCategory: deriveNpmRisk(name),
  });
}

function deriveNpmPurpose(name) {
  if (name.includes("@mediapipe")) return "안면/홍채 추적 (5채널 보조 분석)";
  if (name === "@tensorflow/tfjs") return "WebAssembly 추론 런타임";
  if (name.startsWith("@aws-sdk/")) return "S3 미디어 저장 (선택)";
  if (name === "next" || name === "react" || name === "react-dom") return "Web 프레임워크 / UI 런타임";
  if (name === "pg" || name === "@types/pg") return "PostgreSQL 클라이언트";
  if (name === "tesseract.js") return "이미지 OCR (Step 6)";
  if (name === "lucide-react") return "UI 아이콘";
  if (name === "zod") return "API 입력값 검증 (SI-05)";
  return "Web/Node 런타임 라이브러리";
}

function deriveNpmRisk(name) {
  if (name.includes("@mediapipe") || name === "@tensorflow/tfjs") return "B";
  if (name.startsWith("@aws-sdk/")) return "B";
  return "A";
}

// ─────────────────────────────────────────────────────────────────
// 2) Python (voice-analysis-service) 의존성
// ─────────────────────────────────────────────────────────────────
const pythonReqPath = join(projectRoot, "voice-analysis-service", "requirements.txt");
const pyEntries = [];
if (existsSync(pythonReqPath)) {
  const lines = readFileSync(pythonReqPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  for (const line of lines) {
    const [namePart, versionPart] = line.split("==");
    if (!namePart) continue;
    pyEntries.push({
      name: namePart.trim(),
      version: (versionPart ?? "unspecified").trim(),
      license: null,
      sourceType: "pypi",
      purpose: derivePypiPurpose(namePart.trim()),
      riskCategory: "B",
    });
  }
}

function derivePypiPurpose(name) {
  if (name === "praat-parselmouth") return "음향 분석 (jitter/shimmer/HNR/F0/Formant)";
  if (name === "fastapi") return "Python 마이크로서비스 프레임워크";
  if (name === "numpy") return "수치 계산 (음향 분석 백본)";
  return "Python 음향 분석 의존";
}

// ─────────────────────────────────────────────────────────────────
// 3) 외부 AI 모델 (직접 파일/엔드포인트 형태)
// ─────────────────────────────────────────────────────────────────
const modelEntries = [
  {
    name: "openai-whisper-1",
    version: "whisper-1 (api fixed)",
    license: "OpenAI Terms of Service",
    sourceType: "model",
    purpose: "음성 전사 보조 (서버 경로). DEV/WASM fallback 정책으로 격리",
    riskCategory: "C",
  },
  {
    name: "mediapipe-face-landmarker",
    version: "local-asset (face_landmarker.task)",
    license: "Apache-2.0",
    sourceType: "model",
    purpose: "안면 478 랜드마크 (lip + iris). 온디바이스 WASM",
    riskCategory: "B",
  },
];

// ─────────────────────────────────────────────────────────────────
// 4) 정규화 + 정렬 + 출력
// ─────────────────────────────────────────────────────────────────
const allRaw = [...npmEntries, ...pyEntries, ...modelEntries];

function normalize(raw) {
  const sourceType = raw.sourceType;
  const baseChange =
    sourceType === "model"
      ? ["model_eval", "version_pin", "security_scan"]
      : ["security_scan", "version_pin"];
  const safe = raw.name
    .replace(/^@/, "")
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/_+/g, "_");
  return {
    id: `SOUP-${sourceType.toUpperCase()}-${safe}`,
    name: raw.name,
    version: String(raw.version || "").trim(),
    license: raw.license ?? null,
    sourceType,
    purpose: raw.purpose,
    riskCategory: raw.riskCategory,
    changeControl: baseChange,
  };
}

const seen = new Set();
const list = [];
for (const raw of allRaw) {
  const entry = normalize(raw);
  if (seen.has(entry.id)) continue;
  seen.add(entry.id);
  list.push(entry);
}
list.sort((a, b) => {
  if (a.sourceType !== b.sourceType) return a.sourceType < b.sourceType ? -1 : 1;
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
});

const summary = {
  total: list.length,
  byRisk: { A: 0, B: 0, C: 0 },
  bySource: { npm: 0, pypi: 0, system: 0, model: 0 },
};
for (const entry of list) {
  summary.byRisk[entry.riskCategory] += 1;
  summary.bySource[entry.sourceType] += 1;
}

const generatedAt = new Date().toISOString();
const stamp = generatedAt.replace(/[:.]/g, "").slice(0, 15);
const outputJson = {
  exportType: "brainfriends-soup-list",
  generatedAt,
  productName: pkg.name,
  productVersion: pkg.version,
  summary,
  entries: list,
};

const outPath = join(outDir, `soup-list-${stamp}.json`);
const latestPath = join(outDir, "latest.json");
writeFileSync(outPath, JSON.stringify(outputJson, null, 2), "utf8");
writeFileSync(latestPath, JSON.stringify(outputJson, null, 2), "utf8");

const md = [
  `# SOUP 목록 (BrainFriends)`,
  ``,
  `생성: ${generatedAt}`,
  `제품: ${pkg.name} ${pkg.version}`,
  ``,
  `## 요약`,
  ``,
  `- 총 ${summary.total} 항목`,
  `- 위험도: A=${summary.byRisk.A}, B=${summary.byRisk.B}, C=${summary.byRisk.C}`,
  `- 출처: npm=${summary.bySource.npm}, pypi=${summary.bySource.pypi}, model=${summary.bySource.model}, system=${summary.bySource.system}`,
  ``,
  `## 항목`,
  ``,
  `| ID | 이름 | 버전 | 출처 | 위험 | 용도 | 라이선스 | 변경통제 |`,
  `|---|---|---|---|---|---|---|---|`,
  ...list.map(
    (e) =>
      `| ${e.id} | ${e.name} | ${e.version} | ${e.sourceType} | ${e.riskCategory} | ${e.purpose} | ${e.license ?? "-"} | ${e.changeControl.join(", ")} |`,
  ),
  ``,
].join("\n");
writeFileSync(join(outDir, "latest.md"), md, "utf8");

console.log(`[soup] generated ${list.length} entries → ${outPath}`);
console.log(`[soup] summary: A=${summary.byRisk.A} B=${summary.byRisk.B} C=${summary.byRisk.C}`);
