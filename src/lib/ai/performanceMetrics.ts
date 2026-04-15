import type { EvaluationSample } from "./evaluationDataset";

export interface AiPerformanceSummary {
  n: number;
  transcriptExactMatchRate: number;
  consonantMae: number;
  vowelMae: number;
  avgTrackingQuality: number;
  avgProcessingMs: number;
}

function average(nums: number[]) {
  return nums.length ? nums.reduce((sum, value) => sum + value, 0) / nums.length : 0;
}

export function summarizeAiPerformance(
  samples: EvaluationSample[],
): AiPerformanceSummary {
  const exactMatches = samples.filter(
    (sample) => sample.transcript.trim() === sample.groundTruthTranscript.trim(),
  ).length;

  const consonantErrors = samples.map((sample) =>
    Math.abs(sample.consonantAccuracy - sample.groundTruthConsonant),
  );
  const vowelErrors = samples.map((sample) =>
    Math.abs(sample.vowelAccuracy - sample.groundTruthVowel),
  );

  return {
    n: samples.length,
    transcriptExactMatchRate: Number(
      ((exactMatches / Math.max(samples.length, 1)) * 100).toFixed(2),
    ),
    consonantMae: Number(average(consonantErrors).toFixed(2)),
    vowelMae: Number(average(vowelErrors).toFixed(2)),
    avgTrackingQuality: Number(
      average(samples.map((sample) => sample.trackingQuality)).toFixed(2),
    ),
    avgProcessingMs: Number(
      average(samples.map((sample) => sample.processingMs)).toFixed(2),
    ),
  };
}
