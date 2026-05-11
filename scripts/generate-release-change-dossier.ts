/**
 * Release change dossier export.
 *
 * 제26조 SW 변경 후 anomaly / retest / impact 산출물을 release manifest 와 함께 내보낸다.
 *
 * 출력:
 *   - docs/security/manifest/latest-change-dossier.json
 *   - docs/security/manifest/latest-change-dossier.md
 *   - docs/security/manifest/latest-change-dossier.csv
 *
 * 선택 입력:
 *   - docs/security/manifest/change-dossier-input.json
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildReleaseChangeDossier,
  serializeReleaseChangeDossierCsv,
  serializeReleaseChangeDossierJson,
  serializeReleaseChangeDossierMarkdown,
  type ReleaseAnomaly,
  type ReleaseRetestRecord,
} from "../src/lib/server/releaseChangeDossier";
import type { ReleaseManifest } from "../src/lib/server/releaseManifest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const outDir = join(projectRoot, "docs", "security", "manifest");
mkdirSync(outDir, { recursive: true });

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, "")) as T;
}

function loadLatestManifest(): ReleaseManifest {
  const latestPath = join(outDir, "latest.json");
  if (!existsSync(latestPath)) {
    throw new Error("[change-dossier] docs/security/manifest/latest.json not found. Run npm run security:manifest first.");
  }
  return readJson<ReleaseManifest>(latestPath);
}

function loadPreviousManifest(nextManifest: ReleaseManifest): ReleaseManifest {
  const candidates = readdirSync(outDir)
    .filter((name) => /^release-manifest-.*\.json$/.test(name))
    .sort()
    .map((name) => join(outDir, name));

  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const manifest = readJson<ReleaseManifest>(candidates[index]);
    if (manifest.manifestHash !== nextManifest.manifestHash) {
      return manifest;
    }
  }

  return nextManifest;
}

function loadManualInput(): {
  previousManifestPath?: string;
  anomalies?: ReleaseAnomaly[];
  retests?: ReleaseRetestRecord[];
} {
  const inputPath = join(outDir, "change-dossier-input.json");
  if (!existsSync(inputPath)) return {};
  return readJson(inputPath);
}

const nextManifest = loadLatestManifest();
const manualInput = loadManualInput();
const previousManifest = manualInput.previousManifestPath
  ? readJson<ReleaseManifest>(join(projectRoot, manualInput.previousManifestPath))
  : loadPreviousManifest(nextManifest);

const dossier = buildReleaseChangeDossier({
  previousManifest,
  nextManifest,
  generatedAt: new Date().toISOString(),
  anomalies: manualInput.anomalies ?? [],
  retests: manualInput.retests ?? [],
});

writeFileSync(
  join(outDir, "latest-change-dossier.json"),
  serializeReleaseChangeDossierJson(dossier),
  "utf8",
);
writeFileSync(
  join(outDir, "latest-change-dossier.md"),
  serializeReleaseChangeDossierMarkdown(dossier),
  "utf8",
);
writeFileSync(
  join(outDir, "latest-change-dossier.csv"),
  serializeReleaseChangeDossierCsv(dossier),
  "utf8",
);

console.log(
  `[change-dossier] generated latest-change-dossier.* gate=${dossier.summary.releaseGate} kind=${dossier.summary.changeKind}`,
);
