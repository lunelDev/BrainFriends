import { TrainingHistoryEntry } from "@/lib/kwab/SessionManager";
import { StepKey } from "@/features/report/utils/reportHelpers";

type EstimateStatus = "PASS" | "FAIL" | "PENDING";

export interface EstimatedKpiMetric {
  key: "analysisAccuracy" | "clinicalCorrelation" | "icc";
  label: string;
  value: number | null;
  unit: string;
  thresholdLabel: string;
  status: EstimateStatus;
  note?: string;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const avg = (arr: number[]) =>
  arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

const std = (arr: number[]) => {
  if (!arr.length) return 0;
  const m = avg(arr);
  return Math.sqrt(avg(arr.map((v) => (v - m) ** 2)));
};

const toNumber = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const levenshtein = (a: string, b: string): number => {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
};

const textSimilarityPct = (a: string, b: string): number => {
  const aa = (a || "").trim();
  const bb = (b || "").trim();
  if (!aa || !bb) return 0;
  const dist = levenshtein(aa, bb);
  const maxLen = Math.max(aa.length, bb.length, 1);
  return clamp((1 - dist / maxLen) * 100, 0, 100);
};

const readItemScore = (item: any): number | null => {
  if (!item || typeof item !== "object") return null;
  if (typeof item.isCorrect === "boolean") return item.isCorrect ? 100 : 0;

  const directKeys = [
    "readingScore",
    "finalScore",
    "pronunciationScore",
    "symmetryScore",
    "kwabScore",
    "score",
  ];
  for (const key of directKeys) {
    const value = toNumber(item[key]);
    if (value !== null) {
      if (key === "kwabScore") return clamp(value * 10, 0, 100);
      return clamp(value, 0, 100);
    }
  }

  const expected =
    item.text || item.targetText || item.prompt || item.situation || "";
  const predicted = item.transcript || item.userText || "";
  if (expected && predicted) {
    return textSimilarityPct(String(expected), String(predicted));
  }
  return null;
};

const getStepScore = (row: TrainingHistoryEntry, stepKey: StepKey) => {
  const v = row.stepScores?.[stepKey];
  return Number.isFinite(Number(v)) ? Number(v) : 0;
};

const getRehabStepKey = (row: TrainingHistoryEntry): StepKey | null => {
  switch (Number(row.rehabStep || 0)) {
    case 1:
      return "step1";
    case 2:
      return "step2";
    case 3:
      return "step3";
    case 4:
      return "step4";
    case 5:
      return "step5";
    case 6:
      return "step6";
    default:
      return null;
  }
};

const isMeasuredRow = (row: TrainingHistoryEntry) =>
  row.measurementQuality?.overall === "measured";

const buildProxyClinicalScore = (
  row: TrainingHistoryEntry,
  mode: "self" | "rehab",
  stepKey: StepKey | null,
) => {
  const asymmetryRisk = Number(row.facialAnalysisSnapshot?.asymmetryRisk ?? 50);
  const faceComponent = clamp(100 - asymmetryRisk, 0, 100);

  if (mode === "rehab" && stepKey) {
    const base = getStepScore(row, stepKey);
    const consonant = Number(
      row.articulationScores?.[stepKey as "step2" | "step3" | "step4" | "step5"]
        ?.averageConsonantAccuracy ?? 0,
    );
    const vowel = Number(
      row.articulationScores?.[stepKey as "step2" | "step3" | "step4" | "step5"]
        ?.averageVowelAccuracy ?? 0,
    );
    const articulation =
      consonant > 0 || vowel > 0 ? clamp((consonant + vowel) / 2, 0, 100) : base;
    return clamp(base * 0.65 + articulation * 0.2 + faceComponent * 0.15, 0, 100);
  }

  const s = row.stepScores;
  const weighted =
    s.step1 * 0.18 +
    s.step2 * 0.16 +
    s.step3 * 0.18 +
    s.step4 * 0.16 +
    s.step5 * 0.16 +
    s.step6 * 0.16;
  return clamp(weighted * 0.85 + faceComponent * 0.15, 0, 100);
};

const pearson = (xs: number[], ys: number[]) => {
  if (xs.length !== ys.length || xs.length < 3) return null;
  const mx = avg(xs);
  const my = avg(ys);
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const denX = Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0));
  const denY = Math.sqrt(ys.reduce((s, y) => s + (y - my) ** 2, 0));
  if (!denX || !denY) return null;
  return num / (denX * denY);
};

const iccTwoWayAbsolute = (rater1: number[], rater2: number[]) => {
  const n = rater1.length;
  if (n !== rater2.length || n < 3) return null;

  const k = 2;
  const rows = rater1.map((v, i) => [v, rater2[i]]);
  const grandMean = avg(rows.flat());
  const rowMeans = rows.map((r) => avg(r));
  const colMeans = [avg(rater1), avg(rater2)];

  const ssRows = k * rowMeans.reduce((s, m) => s + (m - grandMean) ** 2, 0);
  const ssCols = n * colMeans.reduce((s, m) => s + (m - grandMean) ** 2, 0);
  const ssTotal = rows.flat().reduce((s, v) => s + (v - grandMean) ** 2, 0);
  const ssError = ssTotal - ssRows - ssCols;

  const msRows = ssRows / (n - 1);
  const msCols = ssCols / (k - 1);
  const msErr = ssError / ((n - 1) * (k - 1));

  const denom = msRows + (k - 1) * msErr + (k * (msCols - msErr)) / n;
  if (!denom) return null;
  return (msRows - msErr) / denom;
};

export function buildEstimatedValidationMetrics(params: {
  selected: TrainingHistoryEntry | null;
  peerRows: TrainingHistoryEntry[];
  mode: "self" | "rehab";
  stepKey: StepKey | null;
  selectedItems: any[];
}): EstimatedKpiMetric[] {
  const { selected, peerRows, mode, stepKey, selectedItems } = params;

  const itemScores = selectedItems
    .map((item) => readItemScore(item))
    .filter((v): v is number => v !== null);
  const fallbackScore =
    selected && stepKey ? getStepScore(selected, stepKey) : Number(selected?.aq || 0);
  const analysisAccuracy =
    itemScores.length > 0 ? clamp(avg(itemScores), 0, 100) : clamp(fallbackScore, 0, 100);
  const analysisStatus: EstimateStatus =
    analysisAccuracy >= 95.2 ? "PASS" : "FAIL";

  const aiScores = peerRows.map((row) =>
    mode === "rehab" && stepKey ? getStepScore(row, stepKey) : Number(row.aq || 0),
  );
  const proxyScores = peerRows.map((row) =>
    buildProxyClinicalScore(row, mode, stepKey),
  );

  const r = pearson(aiScores, proxyScores);
  const icc = iccTwoWayAbsolute(aiScores, proxyScores);

  const corrStatus: EstimateStatus =
    r === null ? "PENDING" : r >= 0.85 ? "PASS" : "FAIL";
  const iccStatus: EstimateStatus =
    icc === null ? "PENDING" : icc >= 0.8 ? "PASS" : "FAIL";

  const sampleHint = `표본 ${peerRows.length}건`;

  return [
    {
      key: "analysisAccuracy",
      label: "분석 정확도(추정)",
      value: Number(analysisAccuracy.toFixed(1)),
      unit: "%",
      thresholdLabel: "기준 ≥ 95.2%",
      status: analysisStatus,
      note:
        itemScores.length > 0
          ? `문항 기반 산출 · ${itemScores.length}개 문항`
          : "문항 세부 데이터가 부족해 단계 점수로 대체",
    },
    {
      key: "clinicalCorrelation",
      label: "임상적 상관성(추정)",
      value: r === null ? null : Number(r.toFixed(3)),
      unit: "r",
      thresholdLabel: "기준 ≥ 0.85",
      status: corrStatus,
      note: r === null ? `데이터 부족 (${sampleHint})` : sampleHint,
    },
    {
      key: "icc",
      label: "반복측정 신뢰도 ICC(추정)",
      value: icc === null ? null : Number(icc.toFixed(3)),
      unit: "",
      thresholdLabel: "기준 ≥ 0.80",
      status: iccStatus,
      note: icc === null ? `데이터 부족 (${sampleHint})` : sampleHint,
    },
  ];
}

export function buildAggregateEstimatedValidationMetrics(
  rows: TrainingHistoryEntry[],
): EstimatedKpiMetric[] {
  const sampleRows = rows.filter(
    (row) => row.trainingMode !== "sing" && isMeasuredRow(row),
  );
  if (!sampleRows.length) {
    return [
      {
        key: "analysisAccuracy",
        label: "분석 정확도(추정)",
        value: null,
        unit: "%",
        thresholdLabel: "기준 ≥ 95.2%",
        status: "PENDING",
        note: "표본 없음",
      },
      {
        key: "clinicalCorrelation",
        label: "임상적 상관성(추정)",
        value: null,
        unit: "r",
        thresholdLabel: "기준 ≥ 0.85",
        status: "PENDING",
        note: "표본 없음",
      },
      {
        key: "icc",
        label: "반복측정 신뢰도 ICC(추정)",
        value: null,
        unit: "",
        thresholdLabel: "기준 ≥ 0.80",
        status: "PENDING",
        note: "표본 없음",
      },
    ];
  }

  const allItemScores: number[] = [];
  const aiScores: number[] = [];
  const proxyScores: number[] = [];
  const selfRows = sampleRows.filter(
    (row) => row.trainingMode === "self" || !row.trainingMode,
  );
  const rehabRows = sampleRows.filter((row) => row.trainingMode === "rehab");

  for (const row of sampleRows) {
    if (row.trainingMode === "rehab") {
      const stepKey = getRehabStepKey(row);
      if (!stepKey) continue;
      const stepItems = row.stepDetails?.[stepKey] ?? [];
      const itemScores = stepItems
        .map((item) => readItemScore(item))
        .filter((v): v is number => v !== null);
      if (itemScores.length) {
        allItemScores.push(...itemScores);
      } else {
        allItemScores.push(getStepScore(row, stepKey));
      }
      aiScores.push(getStepScore(row, stepKey));
      proxyScores.push(buildProxyClinicalScore(row, "rehab", stepKey));
      continue;
    }

    const selfItems = (
      [
        ...(row.stepDetails?.step1 ?? []),
        ...(row.stepDetails?.step2 ?? []),
        ...(row.stepDetails?.step3 ?? []),
        ...(row.stepDetails?.step4 ?? []),
        ...(row.stepDetails?.step5 ?? []),
        ...(row.stepDetails?.step6 ?? []),
      ] as any[]
    )
      .map((item) => readItemScore(item))
      .filter((v): v is number => v !== null);

    if (selfItems.length) {
      allItemScores.push(...selfItems);
    } else {
      allItemScores.push(Number(row.aq || 0));
    }
    aiScores.push(Number(row.aq || 0));
    proxyScores.push(buildProxyClinicalScore(row, "self", null));
  }

  const analysisAccuracy = allItemScores.length
    ? clamp(avg(allItemScores), 0, 100)
    : null;
  const r = pearson(aiScores, proxyScores);
  const icc = iccTwoWayAbsolute(aiScores, proxyScores);
  const sampleHint = `측정 완료 표본 ${sampleRows.length}건`;
  const sampleDetailHint = `self ${selfRows.length}건 · rehab ${rehabRows.length}건`;

  return [
    {
      key: "analysisAccuracy",
      label: "분석 정확도(추정)",
      value: analysisAccuracy === null ? null : Number(analysisAccuracy.toFixed(1)),
      unit: "%",
      thresholdLabel: "기준 ≥ 95.2%",
      status:
        analysisAccuracy === null
          ? "PENDING"
          : analysisAccuracy >= 95.2
            ? "PASS"
            : "FAIL",
      note: allItemScores.length
        ? `문항 기반 산출 · ${allItemScores.length}개 문항 · ${sampleDetailHint}`
        : `데이터 부족 (${sampleHint})`,
    },
    {
      key: "clinicalCorrelation",
      label: "임상적 상관성(추정)",
      value: r === null ? null : Number(r.toFixed(3)),
      unit: "r",
      thresholdLabel: "기준 ≥ 0.85",
      status: r === null ? "PENDING" : r >= 0.85 ? "PASS" : "FAIL",
      note: r === null ? `데이터 부족 (${sampleHint})` : `${sampleHint} · ${sampleDetailHint}`,
    },
    {
      key: "icc",
      label: "반복측정 신뢰도 ICC(추정)",
      value: icc === null ? null : Number(icc.toFixed(3)),
      unit: "",
      thresholdLabel: "기준 ≥ 0.80",
      status: icc === null ? "PENDING" : icc >= 0.8 ? "PASS" : "FAIL",
      note: icc === null ? `데이터 부족 (${sampleHint})` : `${sampleHint} · ${sampleDetailHint}`,
    },
  ];
}

export function getEstimatedKpiSummary(metrics: EstimatedKpiMetric[]) {
  const decided = metrics.filter((m) => m.status !== "PENDING");
  const passCount = metrics.filter((m) => m.status === "PASS").length;
  const failCount = metrics.filter((m) => m.status === "FAIL").length;
  const pendingCount = metrics.filter((m) => m.status === "PENDING").length;
  const decidedCv = decided
    .map((m) => (m.value === null ? null : Math.abs(m.value)))
    .filter((v): v is number => v !== null);
  const variability = decidedCv.length > 1 ? std(decidedCv) : 0;
  return {
    passCount,
    failCount,
    pendingCount,
    variability: Number(variability.toFixed(3)),
  };
}
