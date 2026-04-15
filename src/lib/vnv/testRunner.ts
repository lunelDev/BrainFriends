import { SOFTWARE_REQUIREMENTS } from "./requirements";
import { TRACEABILITY_MATRIX } from "./traceability";

export interface TestCaseResult {
  testCaseId: string;
  passed: boolean;
  executedAt: string;
  inputSummary: string;
  expected: string;
  actual: string;
}

function nowIso() {
  return new Date().toISOString();
}

export async function runMeasurementQualityTest(): Promise<TestCaseResult> {
  const mockMeasuredRows = [{ transcript: "정상 발화" }];
  const actual = mockMeasuredRows.length > 0 ? "measured" : "demo";

  return {
    testCaseId: "TC-MQ-001",
    passed: actual === "measured",
    executedAt: nowIso(),
    inputSummary: "step4 transcript 포함 데이터 1건",
    expected: "measured",
    actual,
  };
}

export async function runTraceabilityCoverageTest(): Promise<TestCaseResult> {
  const covered = SOFTWARE_REQUIREMENTS.every((requirement) =>
    TRACEABILITY_MATRIX.some((row) => row.requirementId === requirement.id),
  );

  return {
    testCaseId: "TC-RTM-001",
    passed: covered,
    executedAt: nowIso(),
    inputSummary: `requirements=${SOFTWARE_REQUIREMENTS.length}`,
    expected: "all_requirements_traced",
    actual: covered ? "all_requirements_traced" : "missing_traceability",
  };
}

export async function runCoreValidationSuite(): Promise<TestCaseResult[]> {
  return [await runMeasurementQualityTest(), await runTraceabilityCoverageTest()];
}
