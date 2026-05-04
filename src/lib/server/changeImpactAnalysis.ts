// src/lib/server/changeImpactAnalysis.ts
//
// SR-CHANGE-016. Release manifest delta → 영향받는 SR-* 자동 매핑.
// 식약처 AI 적용 가이드라인 PDF #2 §III.5 변경허가, GMP [별표3] 1.1.7 형상관리,
// IEC 62304 §8 SW 변경관리 대응. 변경관리 영향평가 (CIA) 의 결정성 산출.
//
// 입력: 두 manifest 의 components 비교 결과 (added/removed/changed component id 들).
// 출력: 영향받는 SR-* requirement id list + 변경 분류 (대/중/소) + 재평가 트리거.

import type { ReleaseManifestComponent } from "./releaseManifest";

export type ChangeKind = "major" | "minor" | "patch";

export interface ManifestDelta {
  addedComponentIds: string[];
  removedComponentIds: string[];
  changedComponentIds: string[];
}

export interface ChangeImpact {
  delta: ManifestDelta;
  kind: ChangeKind;
  impactedRequirementIds: string[];
  revalidationTriggers: string[];
  /** 변경허가 신청 필요 여부. true 면 식약처 변경허가 대상. */
  requiresRegulatoryFiling: boolean;
}

/**
 * component id 별로 어떤 SR-* 가 영향받는지 정의. 결정성 매핑.
 * gap-matrix + 가이드라인 § 매핑.
 */
const COMPONENT_TO_REQUIREMENTS: Record<string, string[]> = {
  "git-sha": [
    "SR-SEC-SI04-MANIFEST",
    "SR-SEC-SI04-SOUP",
    "SR-CHANGE-016",
  ],
  "package-lock": [
    "SR-SEC-SI04-SOUP",
    "SR-SEC-SI04-MANIFEST",
    "SR-SEC-RA01",
    "SR-SEC-SI05",
    "SR-CHANGE-016",
  ],
  "python-requirements": [
    "SR-SEC-SI04-SOUP",
    "SR-AI-EVAL-014",
    "SR-CHANGE-016",
  ],
  sbom: [
    "SR-SEC-SI04-SOUP",
    "SR-SEC-SI04-MANIFEST",
    "SR-CHANGE-016",
  ],
  soup: [
    "SR-SEC-SI04-SOUP",
    "SR-SEC-SI04-MANIFEST",
    "SR-CHANGE-016",
  ],
};

/** 모델 자산 (id prefix model-asset-) 은 STT/AI 평가 영향. */
function isModelAsset(id: string): boolean {
  return id.startsWith("model-asset-");
}

const MODEL_ASSET_REQUIREMENTS = [
  "SR-STT-009",
  "SR-AI-EVAL-014",
  "SR-CHANGE-016",
  "SR-SEC-SI04-MANIFEST",
];

/**
 * delta 분류:
 *   major — 모델 자산 변경 또는 ≥ 3개 component 변경
 *   minor — package-lock 또는 SBOM 변경
 *   patch — 그 외 (git-sha 만 변경 등)
 */
function classifyChange(delta: ManifestDelta): ChangeKind {
  const all = [
    ...delta.addedComponentIds,
    ...delta.removedComponentIds,
    ...delta.changedComponentIds,
  ];
  if (all.some(isModelAsset)) return "major";
  if (all.length >= 3) return "major";
  if (all.includes("package-lock") || all.includes("sbom")) return "minor";
  return "patch";
}

/**
 * 변경허가 대상 여부. PDF #2 §III.5:
 *   - 알고리즘 변경 (모델 자산) → 변경허가 필요
 *   - 의존성 트리 큰 변경 (≥ 3 component) → 변경허가 필요
 *   - SBOM/SOUP 만 변경 → 변경허가 미해당이지만 GMP 변경 기록 필요
 */
function requiresFiling(delta: ManifestDelta, kind: ChangeKind): boolean {
  if (kind === "major") return true;
  const all = [
    ...delta.addedComponentIds,
    ...delta.removedComponentIds,
    ...delta.changedComponentIds,
  ];
  return all.some(isModelAsset);
}

export function diffManifestComponents(
  previous: ReleaseManifestComponent[],
  next: ReleaseManifestComponent[],
): ManifestDelta {
  const prevMap = new Map(previous.map((c) => [c.id, c]));
  const nextMap = new Map(next.map((c) => [c.id, c]));
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  for (const id of nextMap.keys()) {
    if (!prevMap.has(id)) added.push(id);
    else if (prevMap.get(id)!.sha256 !== nextMap.get(id)!.sha256) changed.push(id);
  }
  for (const id of prevMap.keys()) {
    if (!nextMap.has(id)) removed.push(id);
  }
  added.sort();
  removed.sort();
  changed.sort();
  return {
    addedComponentIds: added,
    removedComponentIds: removed,
    changedComponentIds: changed,
  };
}

export function analyzeChangeImpact(delta: ManifestDelta): ChangeImpact {
  const all = [
    ...delta.addedComponentIds,
    ...delta.removedComponentIds,
    ...delta.changedComponentIds,
  ];
  const kind = classifyChange(delta);
  const impacted = new Set<string>();
  for (const id of all) {
    const direct = COMPONENT_TO_REQUIREMENTS[id];
    if (direct) {
      for (const r of direct) impacted.add(r);
    } else if (isModelAsset(id)) {
      for (const r of MODEL_ASSET_REQUIREMENTS) impacted.add(r);
    }
  }
  const triggers: string[] = [];
  if (kind === "major") {
    triggers.push("ai_performance_revalidation");
    triggers.push("clinical_evaluation_review");
  }
  if (impacted.has("SR-SEC-SI04-SOUP")) triggers.push("security_scan");
  if (impacted.has("SR-AI-EVAL-014")) triggers.push("wer_revalidation");
  if (impacted.has("SR-STT-009")) triggers.push("stt_policy_check");
  triggers.sort();

  const impactedSorted = Array.from(impacted).sort();

  return {
    delta,
    kind,
    impactedRequirementIds: impactedSorted,
    revalidationTriggers: triggers,
    requiresRegulatoryFiling: requiresFiling(delta, kind),
  };
}
