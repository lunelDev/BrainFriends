export type ArticulationProfile = "strict" | "balanced" | "lenient";

export interface ArticulationTuningConfig {
  lowVowelOpeningThreshold: number;
  bilabialClosureThreshold: number;
  vowelWidthTarget: number;
  bilabialPartialMaxScore: number;
  bilabialPartialWidth: number;
  bilabialPartialRange: number;
  nonBilabialWidthTarget: number;
  lowVowelWeights: {
    opening: number;
    width: number;
    hitRatio: number;
  };
  generalVowelWeights: {
    opening: number;
    width: number;
  };
  nonBilabialConsonantWeights: {
    width: number;
    closureTrend: number;
  };
}

const PRESETS: Record<ArticulationProfile, ArticulationTuningConfig> = {
  strict: {
    lowVowelOpeningThreshold: 0.65,
    bilabialClosureThreshold: 0.04,
    vowelWidthTarget: 0.13,
    bilabialPartialMaxScore: 85,
    bilabialPartialWidth: 0.11,
    bilabialPartialRange: 0.06,
    nonBilabialWidthTarget: 0.11,
    lowVowelWeights: { opening: 0.65, width: 0.2, hitRatio: 0.15 },
    generalVowelWeights: { opening: 0.7, width: 0.3 },
    nonBilabialConsonantWeights: { width: 0.55, closureTrend: 0.45 },
  },
  balanced: {
    lowVowelOpeningThreshold: 0.6,
    bilabialClosureThreshold: 0.05,
    vowelWidthTarget: 0.12,
    bilabialPartialMaxScore: 90,
    bilabialPartialWidth: 0.12,
    bilabialPartialRange: 0.07,
    nonBilabialWidthTarget: 0.1,
    lowVowelWeights: { opening: 0.6, width: 0.2, hitRatio: 0.2 },
    generalVowelWeights: { opening: 0.65, width: 0.35 },
    nonBilabialConsonantWeights: { width: 0.5, closureTrend: 0.5 },
  },
  lenient: {
    lowVowelOpeningThreshold: 0.55,
    bilabialClosureThreshold: 0.06,
    vowelWidthTarget: 0.11,
    bilabialPartialMaxScore: 95,
    bilabialPartialWidth: 0.13,
    bilabialPartialRange: 0.08,
    nonBilabialWidthTarget: 0.09,
    lowVowelWeights: { opening: 0.55, width: 0.2, hitRatio: 0.25 },
    generalVowelWeights: { opening: 0.6, width: 0.4 },
    nonBilabialConsonantWeights: { width: 0.45, closureTrend: 0.55 },
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function envNumber(name: string): number | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function pickProfile(): ArticulationProfile {
  const raw = (process.env.NEXT_PUBLIC_ARTICULATION_PROFILE || "balanced")
    .trim()
    .toLowerCase();
  if (raw === "strict" || raw === "lenient" || raw === "balanced") return raw;
  return "balanced";
}

export function getArticulationConfig(): ArticulationTuningConfig {
  const base = PRESETS[pickProfile()];

  const openingWeight =
    envNumber("NEXT_PUBLIC_ARTIC_OPENING_WEIGHT") ?? base.lowVowelWeights.opening;
  const widthWeight =
    envNumber("NEXT_PUBLIC_ARTIC_WIDTH_WEIGHT") ?? base.lowVowelWeights.width;
  const hitRatioWeightRaw =
    envNumber("NEXT_PUBLIC_ARTIC_HIT_RATIO_WEIGHT") ?? base.lowVowelWeights.hitRatio;
  const weightSum = openingWeight + widthWeight + hitRatioWeightRaw || 1;
  const hitRatioWeight = clamp(hitRatioWeightRaw, 0, 1);

  return {
    ...base,
    lowVowelOpeningThreshold: clamp(
      envNumber("NEXT_PUBLIC_ARTIC_LOW_VOWEL_OPENING_THRESHOLD") ??
        base.lowVowelOpeningThreshold,
      0.2,
      1,
    ),
    bilabialClosureThreshold: clamp(
      envNumber("NEXT_PUBLIC_ARTIC_BILABIAL_CLOSURE_THRESHOLD") ??
        base.bilabialClosureThreshold,
      0,
      0.2,
    ),
    vowelWidthTarget: clamp(
      envNumber("NEXT_PUBLIC_ARTIC_VOWEL_WIDTH_TARGET") ?? base.vowelWidthTarget,
      0.03,
      0.4,
    ),
    bilabialPartialMaxScore: clamp(
      envNumber("NEXT_PUBLIC_ARTIC_BILABIAL_PARTIAL_MAX") ??
        base.bilabialPartialMaxScore,
      10,
      100,
    ),
    bilabialPartialWidth: clamp(
      envNumber("NEXT_PUBLIC_ARTIC_BILABIAL_PARTIAL_WIDTH") ??
        base.bilabialPartialWidth,
      0.01,
      0.4,
    ),
    bilabialPartialRange: clamp(
      envNumber("NEXT_PUBLIC_ARTIC_BILABIAL_PARTIAL_RANGE") ??
        base.bilabialPartialRange,
      0.01,
      0.4,
    ),
    nonBilabialWidthTarget: clamp(
      envNumber("NEXT_PUBLIC_ARTIC_NON_BILABIAL_WIDTH_TARGET") ??
        base.nonBilabialWidthTarget,
      0.01,
      0.4,
    ),
    lowVowelWeights: {
      opening: clamp(openingWeight / weightSum, 0, 1),
      width: clamp(widthWeight / weightSum, 0, 1),
      hitRatio: clamp(hitRatioWeight / weightSum, 0, 1),
    },
    generalVowelWeights: base.generalVowelWeights,
    nonBilabialConsonantWeights: base.nonBilabialConsonantWeights,
  };
}
