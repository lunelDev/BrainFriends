import { scoreAacTranscriptMatch } from "@/lib/aac/trainingIntegration";

export type Step2ScoreInput = {
  targetText: string;
  transcript?: string | null;
  consonantAccuracy?: number | null;
  vowelAccuracy?: number | null;
};

const clampScore = (value: unknown) => {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, score));
};

const round1 = (value: number) => Number(value.toFixed(1));

export function calculateStep2FinalScore(input: Step2ScoreInput) {
  const consonantAccuracy = clampScore(input.consonantAccuracy);
  const vowelAccuracy = clampScore(input.vowelAccuracy);
  const articulationScore = round1((consonantAccuracy + vowelAccuracy) / 2);
  const phraseMatchScore = round1(
    scoreAacTranscriptMatch({
      targetText: input.targetText,
      sentence: String(input.transcript || ""),
    }),
  );
  const targetChars = Array.from(
    String(input.targetText || "").replace(/[^\p{L}\p{N}]+/gu, ""),
  ).length;
  const speechWeightedScore = round1(
    articulationScore * 0.7 + phraseMatchScore * 0.3,
  );
  const shortTargetCap = targetChars <= 2 ? Math.max(65, articulationScore + 20) : 100;
  const finalScore = round1(Math.min(shortTargetCap, speechWeightedScore));

  return {
    articulationScore,
    phraseMatchScore,
    finalScore,
  };
}

export function mergeStep2ResultsByIndex<T extends { index?: unknown }>(
  existing: T[],
  nextEntry: T,
  maxItems: number,
) {
  const limit = Math.max(1, Number(maxItems) || 1);
  const byIndex = new Map<number, T>();

  existing.slice(-limit).forEach((row, fallbackIndex) => {
    const resolvedIndex = Number.isFinite(Number(row?.index))
      ? Number(row.index)
      : fallbackIndex;
    if (resolvedIndex < 0 || resolvedIndex >= limit) return;
    byIndex.set(resolvedIndex, row);
  });

  const nextIndex = Number.isFinite(Number(nextEntry?.index))
    ? Number(nextEntry.index)
    : byIndex.size;
  if (nextIndex >= 0 && nextIndex < limit) {
    byIndex.set(nextIndex, nextEntry);
  }

  return Array.from(byIndex.entries())
    .sort((a, b) => a[0] - b[0])
    .map((entry) => entry[1])
    .slice(-limit);
}
