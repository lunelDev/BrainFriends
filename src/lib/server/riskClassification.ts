// src/lib/server/riskClassification.ts
//
// SR-RISK-012. ISO 14971 (Application of risk management to medical devices) 의
// risk = severity × probability 행렬을 결정성 함수로 노출한다.
// 식약처 디지털의료기기 GMP [별표3] 2.1.1~2.1.6 의 위험분석/평가/통제 단계와
// PDF #1 §IV.3 "SW 안전성 등급" 판단 절차의 보조 산출물로 사용한다.
//
// 출력 riskClass:
//   A — 부상 가능성 낮음 (수용 가능, 모니터링)
//   B — 경상 가능성 (위험 통제 필요)
//   C — 중대한 부상 또는 사망 가능성 (즉시 통제 + 잔여위험 검증)

export type Severity = 1 | 2 | 3 | 4 | 5;
export type Probability = 1 | 2 | 3 | 4 | 5;
export type RiskClass = "A" | "B" | "C";

export interface HazardInput {
  hazardId: string;
  description: string;
  severity: Severity;
  probability: Probability;
  /** 통제 후 잔여 심각도 (선택). 없으면 severity 그대로. */
  residualSeverity?: Severity;
  /** 통제 후 잔여 발생가능성 (선택). 없으면 probability 그대로. */
  residualProbability?: Probability;
}

export interface ClassifiedHazard {
  hazardId: string;
  description: string;
  severity: Severity;
  probability: Probability;
  riskScore: number;
  riskClass: RiskClass;
  residualRiskScore: number;
  residualRiskClass: RiskClass;
  /** riskClass 가 잔여 단계에서 낮아졌는가 (위험 통제 효과 여부). */
  controlEffective: boolean;
}

/**
 * severity × probability 점수 (1~25) 를 risk class 로 매핑.
 *  1~6  → A
 *  7~14 → B
 * 15~25 → C
 *
 * 결정성: 동일 입력 → 동일 출력.
 */
export function scoreToRiskClass(score: number): RiskClass {
  if (score <= 6) return "A";
  if (score <= 14) return "B";
  return "C";
}

export function classifyHazard(input: HazardInput): ClassifiedHazard {
  const score = input.severity * input.probability;
  const residualSeverity = input.residualSeverity ?? input.severity;
  const residualProbability = input.residualProbability ?? input.probability;
  const residualScore = residualSeverity * residualProbability;
  const riskClass = scoreToRiskClass(score);
  const residualRiskClass = scoreToRiskClass(residualScore);
  const controlEffective =
    residualScore < score && riskClassRank(residualRiskClass) < riskClassRank(riskClass);
  return {
    hazardId: input.hazardId,
    description: input.description,
    severity: input.severity,
    probability: input.probability,
    riskScore: score,
    riskClass,
    residualRiskScore: residualScore,
    residualRiskClass,
    controlEffective,
  };
}

function riskClassRank(rc: RiskClass): number {
  return rc === "A" ? 0 : rc === "B" ? 1 : 2;
}

export interface HazardSummary {
  total: number;
  byClass: Record<RiskClass, number>;
  byResidualClass: Record<RiskClass, number>;
  /** residualRiskClass 가 C 인 항목 수 — 0 이어야 시판 가능. */
  unacceptable: number;
}

/**
 * 결정성: 동일 hazards 입력 → 동일 summary.
 */
export function summarizeHazards(hazards: ClassifiedHazard[]): HazardSummary {
  const summary: HazardSummary = {
    total: hazards.length,
    byClass: { A: 0, B: 0, C: 0 },
    byResidualClass: { A: 0, B: 0, C: 0 },
    unacceptable: 0,
  };
  for (const h of hazards) {
    summary.byClass[h.riskClass] += 1;
    summary.byResidualClass[h.residualRiskClass] += 1;
    if (h.residualRiskClass === "C") summary.unacceptable += 1;
  }
  return summary;
}

export function classifyHazardList(inputs: HazardInput[]): ClassifiedHazard[] {
  const seen = new Set<string>();
  const list: ClassifiedHazard[] = [];
  for (const input of inputs) {
    if (seen.has(input.hazardId)) continue;
    seen.add(input.hazardId);
    list.push(classifyHazard(input));
  }
  // 결정성 정렬: residualRiskClass desc (C→B→A), 그 다음 hazardId 알파벳.
  list.sort((a, b) => {
    const ra = riskClassRank(b.residualRiskClass) - riskClassRank(a.residualRiskClass);
    if (ra !== 0) return ra;
    return a.hazardId < b.hazardId ? -1 : a.hazardId > b.hazardId ? 1 : 0;
  });
  return list;
}
