// IEC 62366-1 §5.4~5.9 / 식약처 디지털의료기기 GMP [별표3] 1.1.6 / PDF #7 §III.2.바
// 사용성평가 (Usability Engineering) 결정성 평가 함수.
//
// 목적
// - Use Scenario / Primary Operating Function (POF) / Critical Task 정의를 코드로 고정한다.
// - Summative usability test 의 합격기준을 결정성으로 산출한다.
// - 관찰된 use error 가 어느 ISO 14971 위해요인 (RM-*) 의 통제 검증을 수행하는지 자동 매핑한다.
//
// 본 모듈은 임상자료가 아닌 평가 결과 데이터셋만 다룬다. 평가 진행 (모집/녹화/IRB) 은
// `docs/regulatory/usability-evaluation-protocol.md` 의 SOP 를 따른다.

export type UsabilityUserGroup = "patient" | "therapist" | "guardian";
export type UseErrorSeverity = "minor" | "moderate" | "severe";
export type UsabilityEvaluationPhase = "formative" | "summative";

export interface UseScenario {
  /** Stable scenario id, e.g. "T-PATIENT-LOGIN" */
  taskId: string;
  /** Human-readable scenario summary (Korean) */
  description: string;
  userGroup: UsabilityUserGroup;
  /** IEC 62366-1 §5.4 Primary Operating Function */
  primaryOperatingFunction: boolean;
  /** IEC 62366-1 §3.7 critical task (failure → unacceptable risk) */
  criticalTask: boolean;
  /** ISO 14971 hazard ids verified by this scenario (RM-005 / RM-006 / RM-013 / RM-018 etc.) */
  hazardLinks: string[];
  expectedOutcome: string;
}

export interface UseErrorRecord {
  /** Stable error id within a session */
  errorId: string;
  taskId: string;
  participantId: string;
  description: string;
  severity: UseErrorSeverity;
  /** Hazard ids triggered by this use error (RM-*). */
  hazardLinks: string[];
  /** Whether the team confirmed the residual risk control is sufficient. */
  mitigated: boolean;
}

export interface TaskObservation {
  participantId: string;
  taskId: string;
  completed: boolean;
  durationSec?: number;
  errorCount: number;
  useErrors?: UseErrorRecord[];
  comments?: string;
}

export interface SummativeAcceptanceCriteria {
  /** Critical task 합격선. 기본 1.0 (100% completion 요구). */
  criticalTaskCompletionRate: number;
  /** POF (primary operating function) 합격선. 기본 0.8 (80% 이상). */
  primaryTaskCompletionRate: number;
  /** Allowed severe use errors after mitigation. 기본 0. */
  maxUnmitigatedSevereUseErrors: number;
}

export const DEFAULT_SUMMATIVE_CRITERIA: SummativeAcceptanceCriteria = {
  criticalTaskCompletionRate: 1.0,
  primaryTaskCompletionRate: 0.8,
  maxUnmitigatedSevereUseErrors: 0,
};

export interface TaskCompletionStat {
  taskId: string;
  attempts: number;
  completions: number;
  completionRate: number;
  primaryOperatingFunction: boolean;
  criticalTask: boolean;
  pass: boolean;
}

export interface UseErrorBucket {
  severity: UseErrorSeverity;
  count: number;
  unmitigatedCount: number;
  taskIds: string[];
  hazardLinks: string[];
}

export interface HazardCoverageRow {
  hazardId: string;
  verifiedByTaskIds: string[];
  observedUseErrorCount: number;
  unmitigatedSevereCount: number;
}

export interface SummativeEvaluationResult {
  totalParticipants: number;
  totalScenarios: number;
  taskStats: TaskCompletionStat[];
  useErrorBuckets: UseErrorBucket[];
  hazardCoverage: HazardCoverageRow[];
  summativePass: boolean;
  failureReasons: string[];
}

/** Round to 4 decimals to keep deterministic JSON output. */
function round4(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10000) / 10000;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

/**
 * Validate scenario set: every taskId must be unique, hazardLinks deduplicated.
 * Returns scenarios in alphabetic taskId order.
 */
export function normalizeScenarios(scenarios: UseScenario[]): UseScenario[] {
  const seen = new Map<string, UseScenario>();
  for (const scenario of scenarios) {
    if (!scenario.taskId.trim()) continue;
    // Last-wins on duplicate taskId so callers can override defaults explicitly.
    seen.set(scenario.taskId, {
      ...scenario,
      hazardLinks: uniqueSorted(scenario.hazardLinks ?? []),
    });
  }
  return Array.from(seen.values()).sort((a, b) =>
    a.taskId.localeCompare(b.taskId),
  );
}

/**
 * Aggregate per-task completion stats. Determinism: alphabetical taskId order,
 * one attempt per (participantId, taskId) — last-wins if duplicates appear.
 */
export function buildTaskCompletionStats(
  scenarios: UseScenario[],
  observations: TaskObservation[],
): TaskCompletionStat[] {
  const normalized = normalizeScenarios(scenarios);
  const byTask = new Map<string, Map<string, TaskObservation>>();
  for (const observation of observations) {
    if (!observation.participantId || !observation.taskId) continue;
    if (!byTask.has(observation.taskId)) {
      byTask.set(observation.taskId, new Map());
    }
    byTask.get(observation.taskId)!.set(observation.participantId, observation);
  }

  return normalized.map((scenario) => {
    const attempts = byTask.get(scenario.taskId);
    const total = attempts ? attempts.size : 0;
    const completions = attempts
      ? Array.from(attempts.values()).filter((entry) => entry.completed).length
      : 0;
    const completionRate = total === 0 ? 0 : round4(completions / total);
    let pass = true;
    if (scenario.criticalTask) {
      pass = completionRate >= DEFAULT_SUMMATIVE_CRITERIA.criticalTaskCompletionRate;
    } else if (scenario.primaryOperatingFunction) {
      pass = completionRate >= DEFAULT_SUMMATIVE_CRITERIA.primaryTaskCompletionRate;
    }
    if (total === 0) {
      // No data → cannot pass.
      pass = false;
    }
    return {
      taskId: scenario.taskId,
      attempts: total,
      completions,
      completionRate,
      primaryOperatingFunction: scenario.primaryOperatingFunction,
      criticalTask: scenario.criticalTask,
      pass,
    };
  });
}

/**
 * Group use errors by severity. Determinism: severity buckets always returned
 * in fixed order minor → moderate → severe; taskIds and hazardLinks alphabetic.
 */
export function bucketUseErrors(
  observations: TaskObservation[],
): UseErrorBucket[] {
  const allErrors = observations.flatMap((entry) => entry.useErrors ?? []);
  const order: UseErrorSeverity[] = ["minor", "moderate", "severe"];
  return order.map((severity) => {
    const filtered = allErrors.filter((entry) => entry.severity === severity);
    return {
      severity,
      count: filtered.length,
      unmitigatedCount: filtered.filter((entry) => !entry.mitigated).length,
      taskIds: uniqueSorted(filtered.map((entry) => entry.taskId)),
      hazardLinks: uniqueSorted(filtered.flatMap((entry) => entry.hazardLinks)),
    };
  });
}

/**
 * Build hazard coverage view: which RM-* are verified by which scenarios.
 * Determinism: alphabetical hazardId, alphabetical taskIds.
 */
export function buildHazardCoverage(
  scenarios: UseScenario[],
  observations: TaskObservation[],
): HazardCoverageRow[] {
  const normalized = normalizeScenarios(scenarios);
  const allErrors = observations.flatMap((entry) => entry.useErrors ?? []);

  const hazardIds = uniqueSorted([
    ...normalized.flatMap((scenario) => scenario.hazardLinks),
    ...allErrors.flatMap((entry) => entry.hazardLinks),
  ]);

  return hazardIds.map((hazardId) => {
    const verifiedByTaskIds = uniqueSorted(
      normalized
        .filter((scenario) => scenario.hazardLinks.includes(hazardId))
        .map((scenario) => scenario.taskId),
    );
    const linkedErrors = allErrors.filter((entry) =>
      entry.hazardLinks.includes(hazardId),
    );
    return {
      hazardId,
      verifiedByTaskIds,
      observedUseErrorCount: linkedErrors.length,
      unmitigatedSevereCount: linkedErrors.filter(
        (entry) => entry.severity === "severe" && !entry.mitigated,
      ).length,
    };
  });
}

/**
 * Run a deterministic summative evaluation.
 * Returns pass/fail with explicit failureReasons in alphabetic order.
 */
export function evaluateSummativeUsability(
  scenarios: UseScenario[],
  observations: TaskObservation[],
  criteria: SummativeAcceptanceCriteria = DEFAULT_SUMMATIVE_CRITERIA,
): SummativeEvaluationResult {
  const normalized = normalizeScenarios(scenarios);
  const taskStats = buildTaskCompletionStats(normalized, observations).map(
    (stat) => {
      let pass = true;
      if (stat.attempts === 0) {
        pass = false;
      } else if (stat.criticalTask) {
        pass = stat.completionRate >= criteria.criticalTaskCompletionRate;
      } else if (stat.primaryOperatingFunction) {
        pass = stat.completionRate >= criteria.primaryTaskCompletionRate;
      }
      return { ...stat, pass };
    },
  );
  const useErrorBuckets = bucketUseErrors(observations);
  const hazardCoverage = buildHazardCoverage(normalized, observations);

  const participantIds = uniqueSorted(
    observations.map((entry) => entry.participantId).filter(Boolean),
  );

  const failureReasons: string[] = [];

  const criticalFailures = taskStats.filter(
    (stat) => stat.criticalTask && !stat.pass,
  );
  if (criticalFailures.length > 0) {
    failureReasons.push(
      `critical_task_below_threshold:${criticalFailures
        .map((stat) => stat.taskId)
        .sort((a, b) => a.localeCompare(b))
        .join(",")}`,
    );
  }

  const primaryFailures = taskStats.filter(
    (stat) => stat.primaryOperatingFunction && !stat.criticalTask && !stat.pass,
  );
  if (primaryFailures.length > 0) {
    failureReasons.push(
      `primary_task_below_threshold:${primaryFailures
        .map((stat) => stat.taskId)
        .sort((a, b) => a.localeCompare(b))
        .join(",")}`,
    );
  }

  const severeBucket = useErrorBuckets.find((bucket) => bucket.severity === "severe");
  const unmitigatedSevere = severeBucket?.unmitigatedCount ?? 0;
  if (unmitigatedSevere > criteria.maxUnmitigatedSevereUseErrors) {
    failureReasons.push(
      `severe_use_errors_unmitigated:${unmitigatedSevere}>${criteria.maxUnmitigatedSevereUseErrors}`,
    );
  }

  if (participantIds.length === 0 && normalized.length > 0) {
    failureReasons.push("no_participants_recorded");
  }

  failureReasons.sort((a, b) => a.localeCompare(b));

  return {
    totalParticipants: participantIds.length,
    totalScenarios: normalized.length,
    taskStats,
    useErrorBuckets,
    hazardCoverage,
    summativePass: failureReasons.length === 0,
    failureReasons,
  };
}
