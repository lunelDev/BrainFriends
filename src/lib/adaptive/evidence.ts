import type { TrainingHistoryEntry } from "@/lib/kwab/SessionManager";

export type AdaptiveEvidenceRow = {
  historyId: string;
  completedAt: number;
  trainingMode: string;
  step: string;
  itemIndex: number;
  itemKey: string | null;
  itemId: string | null;
  itemLabel: string;
  correct: boolean | null;
  theta: number | null;
  sd: number | null;
  difficulty: number | null;
  discrimination: number | null;
  selectionMethod: string | null;
};

export type AdaptiveEvidenceSummary = {
  count: number;
  latestTheta: number | null;
  latestSd: number | null;
  latestDifficulty: number | null;
  recommendedDifficulty: number | null;
  lastSelectionMethod: string | null;
};

export type AdaptiveEvidenceItemSummary = {
  step: string;
  itemKey: string;
  itemId: string | null;
  itemLabel: string;
  exposureCount: number;
  correctCount: number;
  accuracy: number | null;
  avgTheta: number | null;
  avgDifficulty: number | null;
  avgDiscrimination: number | null;
  selectionMethods: string[];
};

export type AdaptiveEvidenceSessionSummary = {
  historyId: string;
  completedAt: number;
  trainingMode: string;
  rowCount: number;
  correctCount: number;
  accuracy: number | null;
  latestTheta: number | null;
  latestSd: number | null;
  avgDifficulty: number | null;
  lastSelectionMethod: string | null;
};

export type AdaptiveEvidenceAggregateSummary = {
  totalRows: number;
  totalSessions: number;
  totalItems: number;
  mfiRows: number;
  averageAccuracy: number | null;
  latestTheta: number | null;
  itemSummaries: AdaptiveEvidenceItemSummary[];
  sessionSummaries: AdaptiveEvidenceSessionSummary[];
};

function asFiniteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getItemLabel(item: any) {
  return String(
    item?.text ??
      item?.question ??
      item?.prompt ??
      item?.situation ??
      item?.word ??
      item?.adaptiveItemKey ??
      "",
  );
}

function collectStepRows(
  entry: TrainingHistoryEntry,
  step: string,
  items: unknown,
): AdaptiveEvidenceRow[] {
  if (!Array.isArray(items)) return [];
  return items.flatMap((item: any, index) => {
    const hasAdaptiveFields =
      item?.adaptiveItemKey ||
      item?.adaptiveItemId ||
      item?.adaptiveTheta != null ||
      item?.itemDifficulty != null;
    if (!hasAdaptiveFields) return [];
    return [
      {
        historyId: entry.historyId,
        completedAt: entry.completedAt,
        trainingMode: entry.trainingMode ?? "unknown",
        step,
        itemIndex: index + 1,
        itemKey: item?.adaptiveItemKey ? String(item.adaptiveItemKey) : null,
        itemId: item?.adaptiveItemId ? String(item.adaptiveItemId) : null,
        itemLabel: getItemLabel(item),
        correct:
          typeof item?.isCorrect === "boolean" ? Boolean(item.isCorrect) : null,
        theta: asFiniteNumber(item?.adaptiveTheta),
        sd: asFiniteNumber(item?.adaptiveSd),
        difficulty: asFiniteNumber(item?.itemDifficulty),
        discrimination: asFiniteNumber(item?.itemDiscrimination),
        selectionMethod: item?.adaptiveSelectionMethod
          ? String(item.adaptiveSelectionMethod)
          : null,
      },
    ];
  });
}

export function collectAdaptiveEvidence(
  entry: TrainingHistoryEntry | null | undefined,
): AdaptiveEvidenceRow[] {
  if (!entry) return [];
  const stepDetails = entry.stepDetails ?? ({} as TrainingHistoryEntry["stepDetails"]);
  const rows = [
    ...collectStepRows(entry, "step1", stepDetails.step1),
    ...collectStepRows(entry, "step2", stepDetails.step2),
    ...collectStepRows(entry, "step3", stepDetails.step3),
    ...collectStepRows(entry, "step4", stepDetails.step4),
    ...collectStepRows(entry, "step5", stepDetails.step5),
    ...collectStepRows(entry, "step6", stepDetails.step6),
  ];

  const sing = entry.singResult as any;
  if (
    sing?.adaptiveItemKey ||
    sing?.adaptiveItemId ||
    sing?.adaptiveTheta != null ||
    sing?.itemDifficulty != null
  ) {
    rows.push({
      historyId: entry.historyId,
      completedAt: entry.completedAt,
      trainingMode: entry.trainingMode ?? "unknown",
      step: "sing",
      itemIndex: 1,
      itemKey: sing?.adaptiveItemKey ? String(sing.adaptiveItemKey) : null,
      itemId: sing?.adaptiveItemId ? String(sing.adaptiveItemId) : null,
      itemLabel: String(sing?.song ?? ""),
      correct: asFiniteNumber(sing?.score) != null ? Number(sing.score) >= 70 : null,
      theta: asFiniteNumber(sing?.adaptiveTheta),
      sd: asFiniteNumber(sing?.adaptiveSd),
      difficulty: asFiniteNumber(sing?.itemDifficulty),
      discrimination: asFiniteNumber(sing?.itemDiscrimination),
      selectionMethod: sing?.adaptiveSelectionMethod
        ? String(sing.adaptiveSelectionMethod)
        : null,
    });
  }

  return rows;
}

export function summarizeAdaptiveEvidence(
  entry: TrainingHistoryEntry | null | undefined,
): AdaptiveEvidenceSummary | null {
  const rows = collectAdaptiveEvidence(entry);
  if (!rows.length) return null;
  const latest = [...rows]
    .reverse()
    .find(
      (row) =>
        row.theta != null || row.difficulty != null || row.selectionMethod != null,
    );
  if (!latest) return null;
  return {
    count: rows.length,
    latestTheta: latest.theta,
    latestSd: latest.sd,
    latestDifficulty: latest.difficulty,
    recommendedDifficulty: latest.theta,
    lastSelectionMethod: latest.selectionMethod,
  };
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function serializeAdaptiveEvidenceCsv(rows: readonly AdaptiveEvidenceRow[]) {
  const header = [
    "historyId",
    "completedAt",
    "trainingMode",
    "step",
    "itemIndex",
    "itemKey",
    "itemId",
    "itemLabel",
    "correct",
    "theta",
    "sd",
    "difficulty",
    "discrimination",
    "selectionMethod",
  ];
  const body = rows.map((row) =>
    header
      .map((key) => csvEscape(row[key as keyof AdaptiveEvidenceRow]))
      .join(","),
  );
  return [header.join(","), ...body].join("\n");
}

function average(values: Array<number | null | undefined>) {
  const finite = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  if (!finite.length) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function roundNullable(value: number | null, digits = 4) {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function summarizeAdaptiveEvidenceRows(
  rows: readonly AdaptiveEvidenceRow[],
): AdaptiveEvidenceAggregateSummary {
  const sortedRows = [...rows].sort((a, b) => {
    if (a.completedAt !== b.completedAt) return a.completedAt - b.completedAt;
    if (a.historyId !== b.historyId) return a.historyId.localeCompare(b.historyId);
    if (a.step !== b.step) return a.step.localeCompare(b.step);
    return a.itemIndex - b.itemIndex;
  });

  const byItem = new Map<string, AdaptiveEvidenceRow[]>();
  const bySession = new Map<string, AdaptiveEvidenceRow[]>();
  for (const row of sortedRows) {
    const itemKey = `${row.step}:${row.itemKey ?? row.itemId ?? row.itemLabel}`;
    byItem.set(itemKey, [...(byItem.get(itemKey) ?? []), row]);
    bySession.set(row.historyId, [...(bySession.get(row.historyId) ?? []), row]);
  }

  const itemSummaries = Array.from(byItem.entries())
    .map(([, itemRows]) => {
      const first = itemRows[0];
      const correctRows = itemRows.filter((row) => row.correct === true);
      const evaluatedRows = itemRows.filter((row) => row.correct != null);
      return {
        step: first.step,
        itemKey: first.itemKey ?? first.itemId ?? first.itemLabel,
        itemId: first.itemId,
        itemLabel: first.itemLabel,
        exposureCount: itemRows.length,
        correctCount: correctRows.length,
        accuracy: evaluatedRows.length
          ? roundNullable(correctRows.length / evaluatedRows.length, 4)
          : null,
        avgTheta: roundNullable(average(itemRows.map((row) => row.theta)), 4),
        avgDifficulty: roundNullable(average(itemRows.map((row) => row.difficulty)), 4),
        avgDiscrimination: roundNullable(
          average(itemRows.map((row) => row.discrimination)),
          4,
        ),
        selectionMethods: Array.from(
          new Set(
            itemRows
              .map((row) => row.selectionMethod)
              .filter((value): value is string => Boolean(value)),
          ),
        ).sort(),
      };
    })
    .sort((a, b) => {
      if (a.step !== b.step) return a.step.localeCompare(b.step);
      return a.itemKey.localeCompare(b.itemKey);
    });

  const sessionSummaries = Array.from(bySession.entries())
    .map(([historyId, sessionRows]) => {
      const sortedSessionRows = [...sessionRows].sort((a, b) => {
        if (a.completedAt !== b.completedAt) return a.completedAt - b.completedAt;
        if (a.step !== b.step) return a.step.localeCompare(b.step);
        return a.itemIndex - b.itemIndex;
      });
      const latest = [...sortedSessionRows]
        .reverse()
        .find(
          (row) =>
            row.theta != null || row.difficulty != null || row.selectionMethod != null,
        );
      const correctRows = sortedSessionRows.filter((row) => row.correct === true);
      const evaluatedRows = sortedSessionRows.filter((row) => row.correct != null);
      return {
        historyId,
        completedAt: sortedSessionRows[0]?.completedAt ?? 0,
        trainingMode: sortedSessionRows[0]?.trainingMode ?? "unknown",
        rowCount: sortedSessionRows.length,
        correctCount: correctRows.length,
        accuracy: evaluatedRows.length
          ? roundNullable(correctRows.length / evaluatedRows.length, 4)
          : null,
        latestTheta: latest?.theta ?? null,
        latestSd: latest?.sd ?? null,
        avgDifficulty: roundNullable(
          average(sortedSessionRows.map((row) => row.difficulty)),
          4,
        ),
        lastSelectionMethod: latest?.selectionMethod ?? null,
      };
    })
    .sort((a, b) => b.completedAt - a.completedAt);

  const correctRows = sortedRows.filter((row) => row.correct === true);
  const evaluatedRows = sortedRows.filter((row) => row.correct != null);
  const latestThetaRow = [...sortedRows].reverse().find((row) => row.theta != null);

  return {
    totalRows: sortedRows.length,
    totalSessions: bySession.size,
    totalItems: byItem.size,
    mfiRows: sortedRows.filter((row) => row.selectionMethod?.includes("mfi")).length,
    averageAccuracy: evaluatedRows.length
      ? roundNullable(correctRows.length / evaluatedRows.length, 4)
      : null,
    latestTheta: latestThetaRow?.theta ?? null,
    itemSummaries,
    sessionSummaries,
  };
}

export function serializeAdaptiveEvidenceItemSummaryCsv(
  rows: readonly AdaptiveEvidenceItemSummary[],
) {
  const header = [
    "step",
    "itemKey",
    "itemId",
    "itemLabel",
    "exposureCount",
    "correctCount",
    "accuracy",
    "avgTheta",
    "avgDifficulty",
    "avgDiscrimination",
    "selectionMethods",
  ];
  const body = rows.map((row) =>
    [
      row.step,
      row.itemKey,
      row.itemId,
      row.itemLabel,
      row.exposureCount,
      row.correctCount,
      row.accuracy,
      row.avgTheta,
      row.avgDifficulty,
      row.avgDiscrimination,
      row.selectionMethods.join("|"),
    ]
      .map(csvEscape)
      .join(","),
  );
  return [header.join(","), ...body].join("\n");
}

export function serializeAdaptiveEvidenceSessionSummaryCsv(
  rows: readonly AdaptiveEvidenceSessionSummary[],
) {
  const header = [
    "historyId",
    "completedAt",
    "trainingMode",
    "rowCount",
    "correctCount",
    "accuracy",
    "latestTheta",
    "latestSd",
    "avgDifficulty",
    "lastSelectionMethod",
  ];
  const body = rows.map((row) =>
    [
      row.historyId,
      row.completedAt,
      row.trainingMode,
      row.rowCount,
      row.correctCount,
      row.accuracy,
      row.latestTheta,
      row.latestSd,
      row.avgDifficulty,
      row.lastSelectionMethod,
    ]
      .map(csvEscape)
      .join(","),
  );
  return [header.join(","), ...body].join("\n");
}
