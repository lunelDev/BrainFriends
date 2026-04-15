import type { RequirementId } from "./requirements";

export interface TraceabilityRecord {
  requirementId: RequirementId;
  moduleName: string;
  functionName: string;
  testCaseId: string;
}

export interface RuntimeValidationRecord {
  requirementIds: RequirementId[];
  checkpoint: string;
  status: "pass" | "warn";
  detail: string;
  recordedAt: string;
}

export interface RequirementTraceabilitySummary {
  requirementIds: RequirementId[];
  testCaseIds: string[];
  traceability: TraceabilityRecord[];
}

export const TRACEABILITY_MATRIX: TraceabilityRecord[] = [
  {
    requirementId: "SR-LOGIN-001",
    moduleName: "src/app/page.tsx",
    functionName: "submit / routeAfterAuth",
    testCaseId: "TC-LOGIN-001",
  },
  {
    requirementId: "SR-PERMISSION-002",
    moduleName: "src/app/page.tsx",
    functionName: "requestPermissions",
    testCaseId: "TC-PERM-001",
  },
  {
    requirementId: "SR-SESSION-003",
    moduleName: "src/lib/kwab/SessionManager.ts",
    functionName: "saveSession / loadSession / getResumePath",
    testCaseId: "TC-SESS-001",
  },
  {
    requirementId: "SR-SCORE-004",
    moduleName: "src/lib/kwab/SessionManager.ts",
    functionName: "updateKWABScores",
    testCaseId: "TC-SCORE-001",
  },
  {
    requirementId: "SR-HISTORY-005",
    moduleName: "src/lib/kwab/SessionManager.ts",
    functionName: "buildHistoryEntry / saveHistoryEntry",
    testCaseId: "TC-HIST-001",
  },
  {
    requirementId: "SR-MEASURE-006",
    moduleName: "src/lib/kwab/SessionManager.ts",
    functionName: "buildHistoryEntry / measurementQuality",
    testCaseId: "TC-MQ-001",
  },
];

export function getTraceabilityForRequirement(requirementId: RequirementId) {
  return TRACEABILITY_MATRIX.filter((row) => row.requirementId === requirementId);
}

export function buildRequirementTraceabilitySummary(
  requirementIds: RequirementId[],
): RequirementTraceabilitySummary {
  const uniqueRequirementIds = Array.from(new Set(requirementIds));
  const traceability = uniqueRequirementIds.flatMap((requirementId) =>
    getTraceabilityForRequirement(requirementId),
  );
  const testCaseIds = Array.from(
    new Set(traceability.map((row) => row.testCaseId)),
  );

  return {
    requirementIds: uniqueRequirementIds,
    testCaseIds,
    traceability,
  };
}
