// src/lib/vnv/iec62304Export.ts
//
// SR-RISK-012 / SR-CHANGE-016 외 — IEC 62304 별지 제2호 추적성 매트릭스 양식 export.
// 식약처 디지털의료기기 GMP [별표3] 1.1.1 / IEC 62304 §5.7 / PDF #5 [별첨2~5] SOP 부록 양식 대응.
//
// 결정성 함수만 제공한다. 실제 fs 출력은 API route 가 담당.
//
// 별지 제2호 (요구사항-설계-구현-시험-위해 통합) 행 구조:
//   순번 | 요구사항 ID | 요구사항 명 | 검증 방법 | 인수 기준 | 설계 모듈 | 구현 함수 |
//   시험 케이스 ID | 시험 결과 | 시험 일시 | 위해 통제 항목 | 비고
//
// 본 모듈은 (SOFTWARE_REQUIREMENTS, TRACEABILITY_MATRIX, deterministic test results,
// risk hazard list) 를 입력으로 받아 별지 제2호 1행을 생성한다.

import type { SoftwareRequirement, RequirementId } from "./requirements";
import type { TraceabilityRecord } from "./traceability";

export interface Iec62304TestResult {
  testCaseId: string;
  passed: boolean;
  executedAt: string;
  inputSummary?: string;
  expected?: string;
  actual?: string;
}

export interface Iec62304HazardLink {
  hazardId: string;
  /** 이 위해요인을 통제하는 SR-* id 목록 */
  controlledByRequirementIds: RequirementId[];
  description: string;
}

export interface Iec62304Row {
  ordinal: number;
  requirementId: string;
  requirementTitle: string;
  verificationMethod: string;
  acceptanceCriteria: string;
  designModules: string[];
  implementationFunctions: string[];
  testCaseIds: string[];
  testResultSummary: string;
  testExecutedAt: string;
  hazardControlIds: string[];
  remarks: string;
}

export interface BuildIec62304MatrixInput {
  requirements: SoftwareRequirement[];
  traceability: TraceabilityRecord[];
  testResults: Iec62304TestResult[];
  hazardLinks: Iec62304HazardLink[];
}

export interface Iec62304ExportPackage {
  exportType: "brainfriends-iec62304-traceability";
  formVersion: "별지 제2호";
  generatedAt: string;
  productName: string;
  productVersion: string;
  summary: {
    totalRequirements: number;
    totalRows: number;
    uncoveredRequirements: string[];
    /** 시험 결과가 없는 SR. 별지 제2호에서 "시험 미실행"으로 표시. */
    untested: string[];
    /** 위해 통제와 연결된 SR 수 */
    hazardControlled: number;
  };
  rows: Iec62304Row[];
}

/**
 * 결정성: 동일 입력 → 동일 출력. 정렬 키:
 *   1) requirementId 알파벳 (안정 순서)
 *   2) row 안의 designModules / testCaseIds 등 모두 알파벳 정렬.
 */
export function buildIec62304TraceabilityMatrix(
  input: BuildIec62304MatrixInput & { productName: string; productVersion: string; generatedAt: string },
): Iec62304ExportPackage {
  const testMap = new Map(input.testResults.map((r) => [r.testCaseId, r]));
  const hazardByReq = new Map<string, string[]>();
  for (const h of input.hazardLinks) {
    for (const r of h.controlledByRequirementIds) {
      const list = hazardByReq.get(r) ?? [];
      list.push(h.hazardId);
      hazardByReq.set(r, list);
    }
  }

  const sortedRequirements = [...input.requirements].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );

  const rows: Iec62304Row[] = [];
  let ordinal = 1;
  const uncovered: string[] = [];
  const untested: string[] = [];
  let hazardControlled = 0;

  for (const requirement of sortedRequirements) {
    const traceRows = input.traceability.filter((row) => row.requirementId === requirement.id);
    const designModules = Array.from(new Set(traceRows.map((row) => row.moduleName))).sort();
    const implementationFunctions = Array.from(
      new Set(traceRows.map((row) => row.functionName)),
    ).sort();
    const testCaseIds = Array.from(new Set(traceRows.map((row) => row.testCaseId))).sort();

    if (traceRows.length === 0) uncovered.push(requirement.id);

    const linkedResults = testCaseIds
      .map((tcId) => testMap.get(tcId))
      .filter((r): r is Iec62304TestResult => Boolean(r));
    const allPassed =
      linkedResults.length > 0 && linkedResults.every((r) => r.passed === true);
    const someExecuted = linkedResults.length > 0;
    if (!someExecuted) untested.push(requirement.id);
    const testResultSummary = !someExecuted
      ? "시험 미실행"
      : allPassed
        ? `PASS (${linkedResults.length}/${linkedResults.length})`
        : `FAIL (${linkedResults.filter((r) => !r.passed).length}/${linkedResults.length})`;
    const executedAtList = linkedResults.map((r) => r.executedAt).sort();
    const testExecutedAt = executedAtList.length > 0 ? executedAtList[executedAtList.length - 1] : "";

    const hazardControlIds = (hazardByReq.get(requirement.id) ?? []).sort();
    if (hazardControlIds.length > 0) hazardControlled += 1;

    rows.push({
      ordinal: ordinal++,
      requirementId: requirement.id,
      requirementTitle: requirement.title,
      verificationMethod: requirement.verificationMethod,
      acceptanceCriteria: requirement.acceptanceCriteria,
      designModules,
      implementationFunctions,
      testCaseIds,
      testResultSummary,
      testExecutedAt,
      hazardControlIds,
      remarks: traceRows.length === 0 ? "추적성 매트릭스 미연결 — 보강 필요" : "",
    });
  }

  return {
    exportType: "brainfriends-iec62304-traceability",
    formVersion: "별지 제2호",
    generatedAt: input.generatedAt,
    productName: input.productName,
    productVersion: input.productVersion,
    summary: {
      totalRequirements: sortedRequirements.length,
      totalRows: rows.length,
      uncoveredRequirements: uncovered,
      untested,
      hazardControlled,
    },
    rows,
  };
}

/**
 * 별지 제2호 양식 Markdown 직렬화.
 * 결정성: 동일 입력 → 동일 출력 (generatedAt 만 다름).
 */
export function serializeIec62304Markdown(pkg: Iec62304ExportPackage): string {
  const header = [
    `# 추적성 매트릭스 (IEC 62304 별지 제2호)`,
    ``,
    `생성: ${pkg.generatedAt}`,
    `제품: ${pkg.productName} ${pkg.productVersion}`,
    `양식: ${pkg.formVersion}`,
    ``,
    `## 요약`,
    ``,
    `- 총 요구사항: ${pkg.summary.totalRequirements}`,
    `- 추적성 미연결: ${pkg.summary.uncoveredRequirements.length} (${pkg.summary.uncoveredRequirements.join(", ") || "없음"})`,
    `- 시험 미실행: ${pkg.summary.untested.length}`,
    `- 위해 통제 연결: ${pkg.summary.hazardControlled}`,
    ``,
    `## 매트릭스`,
    ``,
    `| 순번 | SR ID | 요구사항 명 | 검증 | 설계 모듈 | 구현 | 시험 ID | 결과 | 위해 통제 |`,
    `|---|---|---|---|---|---|---|---|---|`,
  ];
  const rows = pkg.rows.map((r) => {
    const dm = r.designModules.length > 0 ? r.designModules.join("<br>") : "-";
    const fn = r.implementationFunctions.length > 0 ? r.implementationFunctions.join("<br>") : "-";
    const tc = r.testCaseIds.length > 0 ? r.testCaseIds.join("<br>") : "-";
    const hz = r.hazardControlIds.length > 0 ? r.hazardControlIds.join(", ") : "-";
    return `| ${r.ordinal} | ${r.requirementId} | ${r.requirementTitle} | ${r.verificationMethod} | ${dm} | ${fn} | ${tc} | ${r.testResultSummary} | ${hz} |`;
  });
  return [...header, ...rows, ""].join("\n");
}

/**
 * 별지 제2호 CSV 직렬화 (식약처 제출 시 표 형태로 첨부).
 * 결정성: 동일 입력 → 동일 출력.
 */
export function serializeIec62304Csv(pkg: Iec62304ExportPackage): string {
  const escape = (val: string) => {
    if (/[",\n]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
    return val;
  };
  const lines = [
    [
      "순번",
      "요구사항ID",
      "요구사항명",
      "검증방법",
      "인수기준",
      "설계모듈",
      "구현함수",
      "시험케이스ID",
      "시험결과",
      "시험일시",
      "위해통제",
      "비고",
    ].map(escape).join(","),
  ];
  for (const r of pkg.rows) {
    lines.push(
      [
        String(r.ordinal),
        r.requirementId,
        r.requirementTitle,
        r.verificationMethod,
        r.acceptanceCriteria,
        r.designModules.join("; "),
        r.implementationFunctions.join("; "),
        r.testCaseIds.join("; "),
        r.testResultSummary,
        r.testExecutedAt,
        r.hazardControlIds.join("; "),
        r.remarks,
      ].map(escape).join(","),
    );
  }
  return lines.join("\n") + "\n";
}
