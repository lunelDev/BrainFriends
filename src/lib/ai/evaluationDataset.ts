import type { SpeechFaceMeasurement } from "./measurementTypes";

export interface EvaluationSample extends SpeechFaceMeasurement {
  groundTruthTranscript: string;
  groundTruthConsonant: number;
  groundTruthVowel: number;
  deviceType: string;
  noiseLevel: "low" | "mid" | "high";
  lighting: "bright" | "normal" | "dim";
}

export function canEnterOfficialEvaluation(sample: SpeechFaceMeasurement) {
  return (
    sample.quality === "measured" &&
    sample.trackingQuality >= 70 &&
    sample.processingMs <= 300 &&
    sample.transcript.trim().length > 0
  );
}

export function toEvaluationSample(
  sample: SpeechFaceMeasurement,
  truth: Omit<EvaluationSample, keyof SpeechFaceMeasurement>,
): EvaluationSample {
  if (!canEnterOfficialEvaluation(sample)) {
    throw new Error("official evaluation dataset requires measured quality");
  }

  return {
    ...sample,
    ...truth,
  };
}
