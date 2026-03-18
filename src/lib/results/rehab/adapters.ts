import { TrainingHistoryEntry } from "@/lib/kwab/SessionManager";

export type RehabTrendRow = {
  historyId: string;
  completedAt: number;
  score: number;
};

export type DetailCompareMetric = {
  key: string;
  label: string;
  unit: "%" | "ms" | "dB" | "개" | "점" | "획";
  higherBetter: boolean;
  current: number | null;
  previous: number | null;
};

export type StepResultCard = {
  index: number;
  text: string;
  isCorrect: boolean;
  score: number | null;
  audioUrl?: string;
  userImage?: string;
  feedbackGood?: string;
  feedbackImprove?: string;
};

export type FacialReport = {
  asymmetryRisk: number;
  consonant: number;
  vowel: number;
  overallConsonant: number;
  overallVowel: number;
  step2Consonant: number;
  step2Vowel: number;
  step4Consonant: number;
  step4Vowel: number;
  step5Consonant: number;
  step5Vowel: number;
  riskLabel: string;
  riskDelta: number | null;
  asymmetryDelta: number | null;
  articulationGap: number;
  summary: string;
  trackingQuality: number;
  oralCommissureAsymmetry: number;
  oralCommissureDelta: number | null;
  lipClosureAsymmetry: number;
  lipClosureDelta: number | null;
  vowelArticulationVariance: number;
  vowelArticulationDelta: number | null;
};

export const toNumberOrNull = (value: unknown): number | null => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export const average = (values: Array<number | null>): number | null => {
  const nums = values.filter((v): v is number => v !== null);
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
};

const stepScoreFromRow = (step: number, row: TrainingHistoryEntry | null) =>
  toNumberOrNull(
    row?.stepScores?.[
      `step${step}` as keyof TrainingHistoryEntry["stepScores"]
    ],
  );

const articulationFromRow = (
  step: number,
  row: TrainingHistoryEntry | null,
  key: "averageConsonantAccuracy" | "averageVowelAccuracy",
) => {
  const bag = row?.articulationScores as any;
  return toNumberOrNull(bag?.[`step${step}`]?.[key]);
};

const averageResponseMs = (details: any[]): number | null => {
  const values = extractResponseMsValues(details);
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
};

const averageByKeys = (details: any[], keys: string[]): number | null => {
  const values = details
    .map((d) => {
      for (const key of keys) {
        const value = toNumberOrNull((d as any)?.[key]);
        if (value !== null) return value;
      }
      return null;
    })
    .filter((v): v is number => v !== null);
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
};

const normalizeStep4Score = (value: number | null): number | null => {
  if (value === null) return null;
  return value <= 10 ? value * 10 : value;
};

const extractResponseMsValues = (details: any[]): number[] =>
  details
    .map((d) => {
      const responseTime = toNumberOrNull(d?.responseTime);
      if (responseTime !== null) return responseTime;
      const totalTime = toNumberOrNull(d?.totalTime);
      if (totalTime !== null) {
        return totalTime < 100 ? totalTime * 1000 : totalTime;
      }
      const speechDuration = toNumberOrNull(d?.speechDuration);
      if (speechDuration !== null) {
        return speechDuration < 100 ? speechDuration * 1000 : speechDuration;
      }
      return null;
    })
    .filter((v): v is number => v !== null);

const immediateResponseRatio = (
  details: any[],
  thresholdMs = 2000,
): number | null => {
  const values = extractResponseMsValues(details);
  if (!values.length) return null;
  const immediateCount = values.filter((v) => v <= thresholdMs).length;
  return (immediateCount / values.length) * 100;
};

const correctnessPercent = (details: any[]): number | null => {
  const flags = details
    .map((d) => (typeof d?.isCorrect === "boolean" ? d.isCorrect : null))
    .filter((v): v is boolean => v !== null);
  if (!flags.length) return null;
  const correct = flags.filter(Boolean).length;
  return (correct / flags.length) * 100;
};

const averageWritingConsistency = (details: any[]): number | null => {
  const values = details
    .map((d) => toNumberOrNull(d?.articulationWritingConsistency))
    .filter((v): v is number => v !== null);
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
};

const averageShapeSimilarity = (details: any[]): number | null => {
  const values = details
    .map((d) => toNumberOrNull(d?.shapeSimilarityPct))
    .filter((v): v is number => v !== null);
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
};

const strokeMatchPercent = (details: any[]): number | null => {
  const values = details
    .map((d) => {
      const expected = toNumberOrNull(d?.expectedStrokes);
      const user = toNumberOrNull(d?.userStrokes);
      if (expected === null || user === null || expected <= 0) return null;
      return Math.max(
        0,
        Math.min(100, 100 - (Math.abs(user - expected) / expected) * 100),
      );
    })
    .filter((v): v is number => v !== null);
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
};

const averageStrokeGap = (details: any[]): number | null => {
  const values = details
    .map((d) => {
      const expected = toNumberOrNull(d?.expectedStrokes);
      const user = toNumberOrNull(d?.userStrokes);
      if (expected === null || user === null) return null;
      return Math.abs(user - expected);
    })
    .filter((v): v is number => v !== null);
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
};

export function extractDetailMetrics(
  step: number,
  row: TrainingHistoryEntry | null,
): DetailCompareMetric[] {
  if (!row) return [];
  const stepDetails = row.stepDetails?.[
    `step${step}` as keyof TrainingHistoryEntry["stepDetails"]
  ] as any[] | undefined;
  const details = Array.isArray(stepDetails) ? stepDetails : [];

  if (step === 6) {
    return [
      {
        key: "writingAccuracy",
        label: "쓰기 정확도",
        unit: "%",
        higherBetter: true,
        current: correctnessPercent(details),
        previous: null,
      },
      {
        key: "strokeMatch",
        label: "획순 정확도",
        unit: "%",
        higherBetter: true,
        current: strokeMatchPercent(details),
        previous: null,
      },
      {
        key: "shapeSimilarity",
        label: "형태 유사도",
        unit: "%",
        higherBetter: true,
        current: averageShapeSimilarity(details),
        previous: null,
      },
    ];
  }
  if (step === 1) {
    return [
      {
        key: "comprehensionAccuracy",
        label: "이해 점수",
        unit: "점",
        higherBetter: true,
        current: correctnessPercent(details),
        previous: null,
      },
      {
        key: "decisionSpeed",
        label: "판단 속도",
        unit: "ms",
        higherBetter: false,
        current: averageResponseMs(details),
        previous: null,
      },
      {
        key: "instantResponseRatio",
        label: "즉각 반응 점수",
        unit: "점",
        higherBetter: true,
        current: immediateResponseRatio(details),
        previous: null,
      },
    ];
  }
  if (step === 3) {
    return [
      {
        key: "productionAccuracy",
        label: "산출 점수",
        unit: "점",
        higherBetter: true,
        current: correctnessPercent(details),
        previous: null,
      },
      {
        key: "selectionSpeed",
        label: "선택 속도",
        unit: "ms",
        higherBetter: false,
        current: averageResponseMs(details),
        previous: null,
      },
      {
        key: "instantResponseRatio",
        label: "즉각 반응 점수",
        unit: "점",
        higherBetter: true,
        current: immediateResponseRatio(details),
        previous: null,
      },
    ];
  }
  if (step === 4) {
    return [
      {
        key: "contentDelivery",
        label: "내용 전달력",
        unit: "점",
        higherBetter: true,
        current: normalizeStep4Score(
          averageByKeys(details, ["contentComponentScore", "relevanceScore"]),
        ),
        previous: null,
      },
      {
        key: "speechFluency",
        label: "말하기 유창성",
        unit: "점",
        higherBetter: true,
        current: normalizeStep4Score(
          averageByKeys(details, ["fluencyComponentScore", "fluencyScore", "kwabScore"]),
        ),
        previous: null,
      },
      {
        key: "pronunciationClarity",
        label: "발음 명료도",
        unit: "점",
        higherBetter: true,
        current: averageByKeys(details, ["clarityComponentScore", "consonantAccuracy", "vowelAccuracy"]),
        previous: null,
      },
      {
        key: "speechReaction",
        label: "발화 반응 속도",
        unit: "ms",
        higherBetter: false,
        current: averageByKeys(details, ["responseStartMs", "responseTime"]) ?? averageResponseMs(details),
        previous: null,
      },
    ];
  }
  if (step === 5) {
    const articulationClarity = averageByKeys(details, [
      "articulationClarityScore",
    ]);
    const fallbackClarity =
      articulationClarity !== null
        ? articulationClarity
        : average([
            averageByKeys(details, ["consonantAccuracy"]),
            averageByKeys(details, ["vowelAccuracy"]),
          ]);
    return [
      {
        key: "readingAccuracy",
        label: "읽기 정확도",
        unit: "점",
        higherBetter: true,
        current: averageByKeys(details, ["readingAccuracyScore", "readingScore"]),
        previous: null,
      },
      {
        key: "readingFluency",
        label: "낭독 유창성",
        unit: "점",
        higherBetter: true,
        current: averageByKeys(details, ["fluencyScore", "readingScore"]),
        previous: null,
      },
      {
        key: "articulationClarity",
        label: "조음 명료도",
        unit: "점",
        higherBetter: true,
        current: fallbackClarity,
        previous: null,
      },
      {
        key: "recognitionSpeed",
        label: "인식 반응 속도",
        unit: "ms",
        higherBetter: false,
        current:
          averageByKeys(details, ["recognitionResponseMs", "responseTime"]) ??
          averageResponseMs(details),
        previous: null,
      },
    ];
  }
  return [
    {
      key: "score",
      label: "훈련 점수",
      unit: "점",
      higherBetter: true,
      current: stepScoreFromRow(step, row),
      previous: null,
    },
    {
      key: "accuracy",
      label: "정답률",
      unit: "%",
      higherBetter: true,
      current: correctnessPercent(details),
      previous: null,
    },
    {
      key: "consonant",
      label: "자음 점수",
      unit: "점",
      higherBetter: true,
      current: articulationFromRow(step, row, "averageConsonantAccuracy"),
      previous: null,
    },
    {
      key: "vowel",
      label: "모음 점수",
      unit: "점",
      higherBetter: true,
      current: articulationFromRow(step, row, "averageVowelAccuracy"),
      previous: null,
    },
    {
      key: "reaction",
      label: "평균 반응시간",
      unit: "ms",
      higherBetter: false,
      current: averageResponseMs(details),
      previous: null,
    },
    {
      key: "audio",
      label: "평균 음성 레벨",
      unit: "dB",
      higherBetter: true,
      current: average(details.map((d) => toNumberOrNull(d?.audioLevel))),
      previous: null,
    },
    {
      key: "itemCount",
      label: "문항 수",
      unit: "개",
      higherBetter: true,
      current: details.length,
      previous: null,
    },
  ];
}

export function buildTrendRows(
  stepRows: TrainingHistoryEntry[],
  stepKey: keyof TrainingHistoryEntry["stepScores"],
): RehabTrendRow[] {
  return [...stepRows]
    .reverse()
    .slice(-8)
    .map((row) => ({
      historyId: row.historyId,
      completedAt: row.completedAt,
      score: Number(row.stepScores?.[stepKey] ?? 0),
    }));
}

export function buildTrendChart(trendRows: RehabTrendRow[]) {
  if (!trendRows.length) return null;
  const width = 640;
  const height = 200;
  const padLeft = 24;
  const padRight = 12;
  const padTop = 16;
  const padBottom = 34;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const xGap = trendRows.length > 1 ? plotW / (trendRows.length - 1) : 0;
  const toY = (score: number) => padTop + ((100 - score) / 100) * plotH;
  const points = trendRows.map((row, idx) => ({
    x: padLeft + idx * xGap,
    y: toY(Math.max(0, Math.min(100, row.score))),
    score: row.score,
    label: new Date(row.completedAt).toLocaleDateString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
    }),
  }));
  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  return {
    width,
    height,
    padLeft,
    padRight,
    padTop,
    padBottom,
    points,
    polyline,
  };
}

export function buildFacialReport(
  latestSessionRow: TrainingHistoryEntry | null,
  previousSessionRow: TrainingHistoryEntry | null,
): FacialReport | null {
  if (!latestSessionRow) return null;
  const snap = latestSessionRow.facialAnalysisSnapshot;
  const asymmetryRisk = Number(snap?.asymmetryRisk ?? 0);
  const consonant = Number(
    snap?.overallConsonant ??
      average([
        toNumberOrNull(
          latestSessionRow.articulationScores?.step2?.averageConsonantAccuracy,
        ),
        toNumberOrNull(
          latestSessionRow.articulationScores?.step4?.averageConsonantAccuracy,
        ),
        toNumberOrNull(
          latestSessionRow.articulationScores?.step5?.averageConsonantAccuracy,
        ),
      ]) ??
      0,
  );
  const vowel = Number(
    snap?.overallVowel ??
      average([
        toNumberOrNull(
          latestSessionRow.articulationScores?.step2?.averageVowelAccuracy,
        ),
        toNumberOrNull(
          latestSessionRow.articulationScores?.step4?.averageVowelAccuracy,
        ),
        toNumberOrNull(
          latestSessionRow.articulationScores?.step5?.averageVowelAccuracy,
        ),
      ]) ??
      0,
  );
  const prevRisk = toNumberOrNull(
    previousSessionRow?.facialAnalysisSnapshot?.asymmetryRisk,
  );
  const riskDelta =
    prevRisk === null ? null : Number((asymmetryRisk - prevRisk).toFixed(1));
  const oralCommissureAsymmetry = Number(
    snap?.sessionAverage?.oralCommissureAsymmetry ?? asymmetryRisk,
  );
  const lipClosureAsymmetry = Number(
    snap?.sessionAverage?.lipClosureAsymmetry ?? asymmetryRisk,
  );
  const vowelArticulationVariance = Number(
    snap?.sessionAverage?.vowelArticulationVariance ??
      Math.abs(consonant - vowel),
  );
  const trackingQuality = Number(snap?.trackingQuality ?? 0);
  const oralCommissureDelta =
    toNumberOrNull(snap?.longitudinalDelta?.oralCommissureAsymmetry) ??
    toNumberOrNull(snap?.delta?.oralCommissureAsymmetry);
  const lipClosureDelta =
    toNumberOrNull(snap?.longitudinalDelta?.lipClosureAsymmetry) ??
    toNumberOrNull(snap?.delta?.lipClosureAsymmetry);
  const vowelArticulationDelta =
    toNumberOrNull(snap?.longitudinalDelta?.vowelArticulationVariance) ??
    toNumberOrNull(snap?.delta?.vowelArticulationVariance);
  const riskLabel =
    asymmetryRisk >= 45 ? "고위험" : asymmetryRisk >= 30 ? "주의" : "저위험";
  const hasCameraData = consonant > 0 || vowel > 0 || asymmetryRisk > 0;
  return {
    asymmetryRisk,
    consonant,
    vowel,
    overallConsonant: consonant,
    overallVowel: vowel,
    step2Consonant: consonant,
    step2Vowel: vowel,
    step4Consonant: consonant,
    step4Vowel: vowel,
    step5Consonant: consonant,
    step5Vowel: vowel,
    riskLabel,
    riskDelta,
    asymmetryDelta: riskDelta,
    articulationGap: Number(Math.abs(consonant - vowel).toFixed(1)),
    trackingQuality,
    oralCommissureAsymmetry,
    oralCommissureDelta,
    lipClosureAsymmetry,
    lipClosureDelta,
    vowelArticulationVariance,
    vowelArticulationDelta,
    summary:
      snap?.articulationFaceMatchSummary ||
      (hasCameraData
        ? "음성-안면 매칭 데이터를 기반으로 요약했습니다."
        : "안면 인식 데이터가 부족해 추가 측정이 필요합니다."),
  };
}

export function buildDetailComparisons(
  safeStep: number,
  latestStepRow: TrainingHistoryEntry | null,
  previousStepRow: TrainingHistoryEntry | null,
): DetailCompareMetric[] {
  const currentMetrics = extractDetailMetrics(safeStep, latestStepRow);
  const previousMetrics = extractDetailMetrics(safeStep, previousStepRow);
  const prevByKey = new Map(previousMetrics.map((m) => [m.key, m]));
  return currentMetrics.map((metric) => ({
    ...metric,
    previous: prevByKey.get(metric.key)?.current ?? null,
  }));
}

export function countImprovedMetrics(metrics: DetailCompareMetric[]): number {
  return metrics.filter((m) => {
    if (m.current === null || m.previous === null) return false;
    return m.higherBetter ? m.current > m.previous : m.current < m.previous;
  }).length;
}

export function buildStepResultCards(
  safeStep: number,
  latestStepRow: TrainingHistoryEntry | null,
  detailKey: keyof TrainingHistoryEntry["stepDetails"],
): StepResultCard[] {
  if (!latestStepRow) return [];
  const raw = latestStepRow.stepDetails?.[detailKey];
  const items = Array.isArray(raw) ? raw : [];
  const buildFeedback = (it: any): { good: string; improve: string } | null => {
    if (safeStep !== 6) return null;
    const expected = toNumberOrNull(it?.expectedStrokes);
    const user = toNumberOrNull(it?.userStrokes);
    const consistency = toNumberOrNull(it?.articulationWritingConsistency);
    const similarity = toNumberOrNull(it?.shapeSimilarityPct);
    const strokeGap =
      expected === null || user === null ? null : Math.abs(user - expected);

    const good =
      strokeGap !== null && strokeGap <= 1
        ? "획수 흐름이 안정적입니다"
        : (similarity ?? 0) >= 75
          ? "문자 형태가 목표와 잘 맞습니다"
          : (consistency ?? 0) >= 80
            ? "글자 형태가 비교적 안정적입니다"
            : "완필 시도와 집중이 좋습니다";
    const improve =
      strokeGap === null
        ? "획수 입력을 함께 저장해 정확도를 높여보세요"
        : strokeGap >= 3
          ? `목표 획수(${expected}획)에 더 가깝게 써보세요`
          : (similarity ?? 0) < 65
            ? "글자 윤곽을 천천히 따라 쓰며 형태를 맞춰보세요"
            : (consistency ?? 0) < 70
              ? "획 간 간격을 일정하게 맞춰보세요"
              : "현재 패턴을 유지하며 속도를 천천히 올려보세요";
    return { good, improve };
  };

  const normalizeTo100 = (value: number | null) => {
    if (value === null) return null;
    return value <= 10 ? value * 10 : value;
  };

  return items.map((it: any, idx: number) => {
    const recordedText = String(
      it?.transcript || it?.recognizedText || it?.sttText || "",
    ).trim();
    const targetText = String(
      it?.text ||
        it?.targetText ||
        it?.targetWord ||
        it?.word ||
        it?.prompt ||
        it?.answer ||
        "...",
    );
    const baseText =
      safeStep === 2 || safeStep === 4 || safeStep === 5
        ? recordedText || `${targetText} (인식 텍스트 없음)`
        : targetText;
    const fallbackCorrect =
      safeStep === 4
        ? Number(it?.kwabScore ?? 0) >= 5
        : safeStep === 5
          ? Number(it?.readingScore ?? 0) >= 60
          : false;
    const isCorrect =
      typeof it?.isCorrect === "boolean" ? it.isCorrect : fallbackCorrect;
    const selectedAnswerLabel = String(
      it?.userAnswerLabel || it?.selectedLabel || it?.userAnswer || "",
    ).trim();
    const correctAnswerLabel = String(
      it?.correctAnswerLabel || it?.answerLabel || targetText,
    ).trim();
    const text =
      safeStep === 3 && !isCorrect
        ? `선택: ${selectedAnswerLabel || "선택값 없음"} -> 정답: ${correctAnswerLabel || targetText}`
        : baseText;
    const score =
      safeStep === 2
        ? toNumberOrNull(it?.finalScore ?? it?.speechScore)
        : safeStep === 4
          ? normalizeTo100(
              toNumberOrNull(
                it?.finalScore ??
                  it?.fluencyComponentScore ??
                  it?.fluencyScore ??
                  it?.kwabScore,
              ),
            )
          : safeStep === 5
            ? toNumberOrNull(it?.readingScore ?? it?.finalScore)
            : safeStep === 6
              ? toNumberOrNull(it?.writingScore ?? it?.finalScore)
              : null;
    const feedback = buildFeedback(it);
    return {
      index: idx + 1,
      text,
      isCorrect,
      score,
      audioUrl: typeof it?.audioUrl === "string" ? it.audioUrl : undefined,
      userImage: typeof it?.userImage === "string" ? it.userImage : undefined,
      feedbackGood: feedback?.good,
      feedbackImprove: feedback?.improve,
    };
  });
}
