// src/lib/server/releaseChangeDossier.ts
//
// SR-CHANGE-016. 제26조 SW 변경 후 anomaly / retest / impact 제출 묶음 export.
// release manifest delta 와 수동/자동 anomaly, 재시험 기록을 하나의 결정성 dossier 로 묶는다.

import {
  analyzeChangeImpact,
  diffManifestComponents,
  type ChangeImpact,
  type ManifestDelta,
} from "./changeImpactAnalysis";
import type { ReleaseManifest } from "./releaseManifest";

export type AnomalySeverity = "critical" | "major" | "minor" | "cosmetic";
export type AnomalyStatus =
  | "open"
  | "fixed"
  | "deferred"
  | "accepted_risk"
  | "not_reproducible";
export type RetestStatus = "pass" | "fail" | "blocked" | "not_run";

export interface ReleaseAnomaly {
  id: string;
  title: string;
  severity: AnomalySeverity;
  status: AnomalyStatus;
  affectedComponentIds: string[];
  linkedRequirementIds: string[];
  detectedInVersion?: string;
  disposition?: string;
}

export interface ReleaseRetestRecord {
  id: string;
  testCaseId: string;
  status: RetestStatus;
  relatedAnomalyIds: string[];
  relatedComponentIds: string[];
  executedAt?: string;
  evidence?: string;
}

export interface ReleaseChangeDossier {
  schemaVersion: "bf-release-change-dossier-v1";
  generatedAt: string;
  previousManifestHash: string;
  nextManifestHash: string;
  productName: string;
  productVersion: string;
  delta: ManifestDelta;
  impact: ChangeImpact;
  anomalies: ReleaseAnomaly[];
  retests: ReleaseRetestRecord[];
  summary: {
    changeKind: ChangeImpact["kind"];
    requiresRegulatoryFiling: boolean;
    changedComponentCount: number;
    openAnomalyCount: number;
    blockingAnomalyCount: number;
    failedRetestCount: number;
    blockedRetestCount: number;
    retestCoverage: "complete" | "partial" | "none";
    releaseGate: "ready_for_review" | "blocked" | "requires_manual_review";
  };
  article26Mapping: {
    anomalyList: string;
    retestResult: string;
    impactAssessment: string;
  };
}

function uniqSorted(values: string[]) {
  return Array.from(new Set(values.map((v) => String(v || "").trim()).filter(Boolean))).sort();
}

function normalizeAnomaly(anomaly: ReleaseAnomaly): ReleaseAnomaly {
  return {
    id: String(anomaly.id || "").trim(),
    title: String(anomaly.title || "").trim(),
    severity: anomaly.severity,
    status: anomaly.status,
    affectedComponentIds: uniqSorted(anomaly.affectedComponentIds ?? []),
    linkedRequirementIds: uniqSorted(anomaly.linkedRequirementIds ?? []),
    ...(anomaly.detectedInVersion
      ? { detectedInVersion: String(anomaly.detectedInVersion).trim() }
      : {}),
    ...(anomaly.disposition
      ? { disposition: String(anomaly.disposition).trim() }
      : {}),
  };
}

function normalizeRetest(retest: ReleaseRetestRecord): ReleaseRetestRecord {
  return {
    id: String(retest.id || "").trim(),
    testCaseId: String(retest.testCaseId || "").trim(),
    status: retest.status,
    relatedAnomalyIds: uniqSorted(retest.relatedAnomalyIds ?? []),
    relatedComponentIds: uniqSorted(retest.relatedComponentIds ?? []),
    ...(retest.executedAt ? { executedAt: String(retest.executedAt).trim() } : {}),
    ...(retest.evidence ? { evidence: String(retest.evidence).trim() } : {}),
  };
}

function isBlockingAnomaly(anomaly: ReleaseAnomaly) {
  if (anomaly.status === "fixed" || anomaly.status === "not_reproducible") return false;
  return anomaly.severity === "critical" || anomaly.severity === "major";
}

function countChangedComponents(delta: ManifestDelta) {
  return (
    delta.addedComponentIds.length +
    delta.removedComponentIds.length +
    delta.changedComponentIds.length
  );
}

function resolveRetestCoverage(
  changedComponentIds: string[],
  retests: ReleaseRetestRecord[],
) {
  if (changedComponentIds.length === 0) return "complete" as const;
  const covered = new Set<string>();
  for (const retest of retests) {
    if (retest.status !== "pass") continue;
    for (const componentId of retest.relatedComponentIds) covered.add(componentId);
  }
  if (covered.size === 0) return "none" as const;
  return changedComponentIds.every((componentId) => covered.has(componentId))
    ? ("complete" as const)
    : ("partial" as const);
}

function resolveReleaseGate(params: {
  blockingAnomalyCount: number;
  failedRetestCount: number;
  blockedRetestCount: number;
  retestCoverage: "complete" | "partial" | "none";
}) {
  if (
    params.blockingAnomalyCount > 0 ||
    params.failedRetestCount > 0 ||
    params.blockedRetestCount > 0
  ) {
    return "blocked" as const;
  }
  if (params.retestCoverage !== "complete") {
    return "requires_manual_review" as const;
  }
  return "ready_for_review" as const;
}

export function buildReleaseChangeDossier(input: {
  previousManifest: ReleaseManifest;
  nextManifest: ReleaseManifest;
  generatedAt: string;
  anomalies?: ReleaseAnomaly[];
  retests?: ReleaseRetestRecord[];
}): ReleaseChangeDossier {
  const delta = diffManifestComponents(
    input.previousManifest.components,
    input.nextManifest.components,
  );
  const impact = analyzeChangeImpact(delta);
  const anomalies = (input.anomalies ?? [])
    .map(normalizeAnomaly)
    .filter((anomaly) => anomaly.id && anomaly.title)
    .sort((a, b) => a.id.localeCompare(b.id));
  const retests = (input.retests ?? [])
    .map(normalizeRetest)
    .filter((retest) => retest.id && retest.testCaseId)
    .sort((a, b) => a.id.localeCompare(b.id));

  const allChangedComponentIds = uniqSorted([
    ...delta.addedComponentIds,
    ...delta.removedComponentIds,
    ...delta.changedComponentIds,
  ]);
  const openAnomalyCount = anomalies.filter(
    (anomaly) => anomaly.status === "open" || anomaly.status === "deferred",
  ).length;
  const blockingAnomalyCount = anomalies.filter(isBlockingAnomaly).length;
  const failedRetestCount = retests.filter((retest) => retest.status === "fail").length;
  const blockedRetestCount = retests.filter((retest) => retest.status === "blocked").length;
  const retestCoverage = resolveRetestCoverage(allChangedComponentIds, retests);
  const releaseGate = resolveReleaseGate({
    blockingAnomalyCount,
    failedRetestCount,
    blockedRetestCount,
    retestCoverage,
  });

  return {
    schemaVersion: "bf-release-change-dossier-v1",
    generatedAt: input.generatedAt,
    previousManifestHash: input.previousManifest.manifestHash,
    nextManifestHash: input.nextManifest.manifestHash,
    productName: input.nextManifest.productName,
    productVersion: input.nextManifest.productVersion,
    delta,
    impact,
    anomalies,
    retests,
    summary: {
      changeKind: impact.kind,
      requiresRegulatoryFiling: impact.requiresRegulatoryFiling,
      changedComponentCount: allChangedComponentIds.length,
      openAnomalyCount,
      blockingAnomalyCount,
      failedRetestCount,
      blockedRetestCount,
      retestCoverage,
      releaseGate,
    },
    article26Mapping: {
      anomalyList: "SW 변경 후 발견된 문제 목록과 처분 상태",
      retestResult: "변경 영향 component 별 재시험 결과와 증거",
      impactAssessment: "release manifest delta 기반 영향받는 요구사항과 변경허가 필요 여부",
    },
  };
}

export function serializeReleaseChangeDossierJson(dossier: ReleaseChangeDossier) {
  return JSON.stringify(dossier, null, 2) + "\n";
}

export function serializeReleaseChangeDossierCsv(dossier: ReleaseChangeDossier) {
  const rows = [
    ["section", "id", "status", "severity_or_kind", "related", "summary"],
    [
      "impact",
      "manifest-delta",
      dossier.summary.releaseGate,
      dossier.summary.changeKind,
      dossier.impact.impactedRequirementIds.join("|"),
      `changed=${dossier.summary.changedComponentCount}; filing=${dossier.summary.requiresRegulatoryFiling}`,
    ],
    ...dossier.anomalies.map((anomaly) => [
      "anomaly",
      anomaly.id,
      anomaly.status,
      anomaly.severity,
      anomaly.affectedComponentIds.join("|"),
      anomaly.title,
    ]),
    ...dossier.retests.map((retest) => [
      "retest",
      retest.id,
      retest.status,
      retest.testCaseId,
      retest.relatedComponentIds.join("|"),
      retest.evidence ?? "",
    ]),
  ];

  return rows
    .map((row) =>
      row
        .map((cell) => {
          const text = String(cell ?? "");
          return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(","),
    )
    .join("\n") + "\n";
}

export function serializeReleaseChangeDossierMarkdown(dossier: ReleaseChangeDossier) {
  const anomalyRows =
    dossier.anomalies.length === 0
      ? ["| - | - | - | - | - |"]
      : dossier.anomalies.map(
          (anomaly) =>
            `| ${anomaly.id} | ${anomaly.severity} | ${anomaly.status} | ${anomaly.affectedComponentIds.join(", ") || "-"} | ${anomaly.title} |`,
        );
  const retestRows =
    dossier.retests.length === 0
      ? ["| - | - | - | - |"]
      : dossier.retests.map(
          (retest) =>
            `| ${retest.id} | ${retest.testCaseId} | ${retest.status} | ${retest.relatedComponentIds.join(", ") || "-"} | ${retest.evidence ?? "-"} |`,
        );

  return [
    "# Release Change Dossier",
    "",
    `Generated: ${dossier.generatedAt}`,
    `Product: ${dossier.productName} ${dossier.productVersion}`,
    `Previous manifest: \`${dossier.previousManifestHash}\``,
    `Next manifest: \`${dossier.nextManifestHash}\``,
    "",
    "## Summary",
    "",
    `- Change kind: ${dossier.summary.changeKind}`,
    `- Release gate: ${dossier.summary.releaseGate}`,
    `- Regulatory filing required: ${dossier.summary.requiresRegulatoryFiling}`,
    `- Retest coverage: ${dossier.summary.retestCoverage}`,
    `- Open anomalies: ${dossier.summary.openAnomalyCount}`,
    `- Blocking anomalies: ${dossier.summary.blockingAnomalyCount}`,
    "",
    "## Impact",
    "",
    `- Added components: ${dossier.delta.addedComponentIds.join(", ") || "-"}`,
    `- Removed components: ${dossier.delta.removedComponentIds.join(", ") || "-"}`,
    `- Changed components: ${dossier.delta.changedComponentIds.join(", ") || "-"}`,
    `- Impacted requirements: ${dossier.impact.impactedRequirementIds.join(", ") || "-"}`,
    `- Revalidation triggers: ${dossier.impact.revalidationTriggers.join(", ") || "-"}`,
    "",
    "## Anomaly List",
    "",
    "| ID | Severity | Status | Components | Title |",
    "|---|---|---|---|---|",
    ...anomalyRows,
    "",
    "## Retest Results",
    "",
    "| ID | Test Case | Status | Components | Evidence |",
    "|---|---|---|---|---|",
    ...retestRows,
    "",
  ].join("\n");
}
