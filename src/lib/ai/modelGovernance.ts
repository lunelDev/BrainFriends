export interface ModelGovernanceRecord {
  modelVersion: string;
  analysisVersion: string;
  requirementIds: string[];
  evaluationDatasetVersion: string;
  approvedAt: string;
  approvedBy: string;
}

export const ACTIVE_MODEL_GOVERNANCE: ModelGovernanceRecord = {
  modelVersion: "speech-face-v1.2.0",
  analysisVersion: "analysis-2026-04",
  requirementIds: ["SR-SCORE-004", "SR-MEASURE-006"],
  evaluationDatasetVersion: "evalset-kr-articulation-2026-01",
  approvedAt: "2026-04-14T00:00:00.000Z",
  approvedBy: "qa.manager",
};
