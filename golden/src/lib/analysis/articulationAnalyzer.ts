import { getArticulationConfig } from "@/lib/analysis/articulationConfig";

export interface ArticulationAnalyzerState {
  sampleCount: number;
  vowelHitCount: number;
  bilabialClosureDetected: boolean;
  minMouthOpening: number;
  maxMouthOpening: number;
  closureFrameCount: number;
  prevTimestampMs: number;
  prevOpening: number;
  prevHadClosure: boolean;
  currentClosureMs: number;
  maxClosureHoldMs: number;
  closureHoldEmaMs: number;
  lastClosureReleaseMs: number | null;
  openingTransitionMsSum: number;
  openingTransitionCount: number;
  patternHitCount: number;
}

export interface AnalyzeArticulationParams {
  targetText: string;
  mouthOpening: number;
  mouthWidth: number;
  lipSymmetry?: number;
  timestampMs?: number;
  previousState?: ArticulationAnalyzerState;
}

export interface ConsonantDetailMetrics {
  closureRatePct: number;
  closureHoldMs: number;
  lipSymmetryPct: number;
  openingSpeedMs: number;
  closureHoldScore: number;
  openingSpeedScore: number;
  finalScore: number;
}

export interface VowelDetailMetrics {
  mouthOpeningPct: number;
  mouthWidthPct: number;
  mouthOpeningScore: number;
  mouthWidthScore: number;
  roundingPct: number;
  patternMatchPct: number;
  finalScore: number;
}

export interface ArticulationScoreResult {
  consonantAccuracy: number;
  vowelAccuracy: number;
  consonantDetails: ConsonantDetailMetrics;
  vowelDetails: VowelDetailMetrics;
  nextState: ArticulationAnalyzerState;
}

export interface ArticulationWritingConsistencyParams {
  targetText: string;
  consonantAccuracy?: number | null;
  vowelAccuracy?: number | null;
  writingScore?: number | null;
}

export interface ArticulationWritingConsistencyResult {
  score: number;
  articulationScore: number;
  writingScore: number | null;
  articulationWeight: number;
  writingWeight: number;
}

const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;

// Jungseong indices in modern Hangul composition table.
const LOW_VOWEL_JUNG = new Set([0, 4]); // ㅏ, ㅓ
const ROUNDED_VOWEL_JUNG = new Set([8, 9, 10, 11, 12, 13, 14, 15, 16, 17]); // ㅗ/ㅛ/ㅜ/ㅠ + complex

// Choseong indices: ㅁ(6), ㅂ(7), ㅍ(17)
const BILABIAL_CHO = new Set([6, 7, 17]);
// Jongseong indices containing ㅁ/ㅂ/ㅍ
const BILABIAL_JONG = new Set([16, 17, 18, 26]);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createInitialArticulationAnalyzerState(): ArticulationAnalyzerState {
  return {
    sampleCount: 0,
    vowelHitCount: 0,
    bilabialClosureDetected: false,
    minMouthOpening: Number.POSITIVE_INFINITY,
    maxMouthOpening: 0,
    closureFrameCount: 0,
    prevTimestampMs: 0,
    prevOpening: 0,
    prevHadClosure: false,
    currentClosureMs: 0,
    maxClosureHoldMs: 0,
    closureHoldEmaMs: 0,
    lastClosureReleaseMs: null,
    openingTransitionMsSum: 0,
    openingTransitionCount: 0,
    patternHitCount: 0,
  };
}

function getTextTargets(text: string) {
  let hasLowVowelTarget = false;
  let hasRoundedVowelTarget = false;
  let hasBilabialTarget = false;

  for (const char of text || "") {
    const code = char.charCodeAt(0);
    if (code < HANGUL_BASE || code > HANGUL_END) continue;

    const offset = code - HANGUL_BASE;
    const choIndex = Math.floor(offset / 588);
    const jungIndex = Math.floor((offset % 588) / 28);
    const jongIndex = offset % 28;

    if (LOW_VOWEL_JUNG.has(jungIndex)) hasLowVowelTarget = true;
    if (ROUNDED_VOWEL_JUNG.has(jungIndex)) hasRoundedVowelTarget = true;
    if (BILABIAL_CHO.has(choIndex) || BILABIAL_JONG.has(jongIndex)) {
      hasBilabialTarget = true;
    }

    if (hasLowVowelTarget && hasRoundedVowelTarget && hasBilabialTarget) break;
  }

  return { hasLowVowelTarget, hasRoundedVowelTarget, hasBilabialTarget };
}

export function analyzeArticulation({
  targetText,
  mouthOpening,
  mouthWidth,
  lipSymmetry,
  timestampMs,
  previousState,
}: AnalyzeArticulationParams): ArticulationScoreResult {
  const config = getArticulationConfig();
  const safeOpening = clamp(Number(mouthOpening || 0), 0, 1);
  const safeWidth = clamp(Number(mouthWidth || 0), 0, 1);
  const safeSymmetry = clamp(Number(lipSymmetry || 0.5), 0, 1);
  const prev = previousState ?? createInitialArticulationAnalyzerState();
  const targets = getTextTargets(targetText);
  const nowMs = Number.isFinite(timestampMs) ? Number(timestampMs) : Date.now();
  const deltaMs =
    prev.prevTimestampMs > 0 ? clamp(nowMs - prev.prevTimestampMs, 8, 120) : 33;

  const isLowVowelFrame = safeOpening >= config.lowVowelOpeningThreshold;
  const hasClosureThisFrame = safeOpening <= config.bilabialClosureThreshold;
  const closureFrameCount =
    prev.closureFrameCount + (hasClosureThisFrame ? 1 : 0);
  const currentClosureMs = hasClosureThisFrame
    ? prev.currentClosureMs + deltaMs
    : 0;
  const maxClosureHoldMs = Math.max(prev.maxClosureHoldMs, currentClosureMs);
  const closureHoldEmaMs = hasClosureThisFrame
    ? prev.closureHoldEmaMs * 0.7 + currentClosureMs * 0.3
    : prev.closureHoldEmaMs * 0.9;

  let lastClosureReleaseMs = prev.lastClosureReleaseMs;
  if (prev.prevHadClosure && !hasClosureThisFrame) lastClosureReleaseMs = nowMs;

  let openingTransitionMsSum = prev.openingTransitionMsSum;
  let openingTransitionCount = prev.openingTransitionCount;
  if (
    lastClosureReleaseMs !== null &&
    safeOpening >= config.lowVowelOpeningThreshold
  ) {
    openingTransitionMsSum += nowMs - lastClosureReleaseMs;
    openingTransitionCount += 1;
    lastClosureReleaseMs = null;
  }

  const nextState: ArticulationAnalyzerState = {
    sampleCount: prev.sampleCount + 1,
    vowelHitCount: prev.vowelHitCount + (isLowVowelFrame ? 1 : 0),
    bilabialClosureDetected:
      prev.bilabialClosureDetected || hasClosureThisFrame,
    minMouthOpening: Math.min(prev.minMouthOpening, safeOpening),
    maxMouthOpening: Math.max(prev.maxMouthOpening, safeOpening),
    closureFrameCount,
    prevTimestampMs: nowMs,
    prevOpening: safeOpening,
    prevHadClosure: hasClosureThisFrame,
    currentClosureMs,
    maxClosureHoldMs,
    closureHoldEmaMs,
    lastClosureReleaseMs,
    openingTransitionMsSum,
    openingTransitionCount,
    patternHitCount: prev.patternHitCount,
  };

  const openingScore = clamp(
    (safeOpening / config.lowVowelOpeningThreshold) * 100,
    0,
    100,
  );
  const widthScore = clamp((safeWidth / config.vowelWidthTarget) * 100, 0, 100);
  const vowelHitRatio =
    nextState.sampleCount > 0
      ? (nextState.vowelHitCount / nextState.sampleCount) * 100
      : 0;

  const vowelAccuracy = targets.hasLowVowelTarget
    ? clamp(
        openingScore * config.lowVowelWeights.opening +
          widthScore * config.lowVowelWeights.width +
          vowelHitRatio * config.lowVowelWeights.hitRatio,
        0,
        100,
      )
    : clamp(
        openingScore * config.generalVowelWeights.opening +
          widthScore * config.generalVowelWeights.width,
        0,
        100,
      );

  const widthToOpeningRatio = safeWidth / Math.max(safeOpening, 0.05);
  const roundingPct = clamp(((1.08 - widthToOpeningRatio) / 0.7) * 100, 0, 100);
  const patternHitThisFrame = targets.hasRoundedVowelTarget
    ? roundingPct >= 60
    : targets.hasLowVowelTarget
      ? isLowVowelFrame
      : openingScore >= 55 && widthScore >= 45;
  nextState.patternHitCount =
    prev.patternHitCount + (patternHitThisFrame ? 1 : 0);
  const patternMatchPct =
    nextState.sampleCount > 0
      ? (nextState.patternHitCount / nextState.sampleCount) * 100
      : 0;

  const closureRatePct =
    nextState.sampleCount > 0
      ? (nextState.closureFrameCount / nextState.sampleCount) * 100
      : 0;
  const closureHoldMs = clamp(nextState.closureHoldEmaMs, 0, 800);
  const closureHoldScore = clamp(
    ((closureHoldMs - 40) / (240 - 40)) * 100,
    0,
    100,
  );

  const openingSpeedMs =
    nextState.openingTransitionCount > 0
      ? nextState.openingTransitionMsSum / nextState.openingTransitionCount
      : 420;
  const openingSpeedScore = clamp(
    ((700 - openingSpeedMs) / (700 - 220)) * 100,
    0,
    100,
  );
  const lipSymmetryPct = safeSymmetry * 100;

  const consonantAccuracy = targets.hasBilabialTarget
    ? (() => {
        const baseScore =
          closureRatePct * 0.35 +
          closureHoldScore * 0.25 +
          lipSymmetryPct * 0.2 +
          openingSpeedScore * 0.2;

        const openingRange = Math.max(
          0,
          nextState.maxMouthOpening - Math.min(nextState.minMouthOpening, 1),
        );
        const staticMouthPenalty = clamp(
          ((0.12 - openingRange) / 0.12) * 28,
          0,
          28,
        );
        const noTransitionPenalty =
          nextState.sampleCount >= 10 && nextState.openingTransitionCount === 0
            ? 18
            : 0;
        const closureDominancePenalty = clamp(
          ((closureRatePct - 85) / 15) * 22,
          0,
          22,
        );
        const overHoldPenalty = clamp(
          ((nextState.maxClosureHoldMs - 520) / 520) * 18,
          0,
          18,
        );

        return clamp(
          baseScore -
            staticMouthPenalty -
            noTransitionPenalty -
            closureDominancePenalty -
            overHoldPenalty,
          0,
          100,
        );
      })()
    : clamp(
        (safeWidth / config.nonBilabialWidthTarget) *
          100 *
          config.nonBilabialConsonantWeights.width +
          (1 - safeOpening) *
            100 *
            config.nonBilabialConsonantWeights.closureTrend,
        0,
        100,
      );

  const refinedVowelAccuracy = targets.hasRoundedVowelTarget
    ? clamp(
        openingScore * 0.25 +
          widthScore * 0.2 +
          roundingPct * 0.35 +
          patternMatchPct * 0.2,
        0,
        100,
      )
    : clamp(vowelAccuracy * 0.8 + patternMatchPct * 0.2, 0, 100);

  return {
    consonantAccuracy: Number(consonantAccuracy.toFixed(1)),
    vowelAccuracy: Number(refinedVowelAccuracy.toFixed(1)),
    consonantDetails: {
      closureRatePct: Number(closureRatePct.toFixed(1)),
      closureHoldMs: Number(closureHoldMs.toFixed(1)),
      lipSymmetryPct: Number(lipSymmetryPct.toFixed(1)),
      openingSpeedMs: Number(openingSpeedMs.toFixed(1)),
      closureHoldScore: Number(closureHoldScore.toFixed(1)),
      openingSpeedScore: Number(openingSpeedScore.toFixed(1)),
      finalScore: Number(consonantAccuracy.toFixed(1)),
    },
    vowelDetails: {
      mouthOpeningPct: Number((safeOpening * 100).toFixed(1)),
      mouthWidthPct: Number((safeWidth * 100).toFixed(1)),
      mouthOpeningScore: Number(openingScore.toFixed(1)),
      mouthWidthScore: Number(widthScore.toFixed(1)),
      roundingPct: Number(roundingPct.toFixed(1)),
      patternMatchPct: Number(patternMatchPct.toFixed(1)),
      finalScore: Number(refinedVowelAccuracy.toFixed(1)),
    },
    nextState,
  };
}

export function calculateArticulationWritingConsistency({
  targetText,
  consonantAccuracy,
  vowelAccuracy,
  writingScore,
}: ArticulationWritingConsistencyParams): ArticulationWritingConsistencyResult {
  const toValid = (v: number | null | undefined): number | null => {
    if (!Number.isFinite(Number(v))) return null;
    return clamp(Number(v), 0, 100);
  };

  const consonant = toValid(consonantAccuracy);
  const vowel = toValid(vowelAccuracy);
  const writing = toValid(writingScore);
  const targets = getTextTargets(targetText || "");

  const consonantWeight = targets.hasBilabialTarget ? 0.6 : 0.45;
  const vowelWeight = 1 - consonantWeight;

  const articulationScore = (() => {
    if (consonant !== null && vowel !== null) {
      return consonant * consonantWeight + vowel * vowelWeight;
    }
    if (consonant !== null) return consonant;
    if (vowel !== null) return vowel;
    return 0;
  })();

  if (writing === null) {
    return {
      score: Number(articulationScore.toFixed(1)),
      articulationScore: Number(articulationScore.toFixed(1)),
      writingScore: null,
      articulationWeight: 1,
      writingWeight: 0,
    };
  }

  const articulationWeight = 0.72;
  const writingWeight = 0.28;
  const blended =
    articulationScore * articulationWeight + writing * writingWeight;
  const agreementPenalty = Math.abs(articulationScore - writing) * 0.2;
  const score = clamp(blended - agreementPenalty, 0, 100);

  return {
    score: Number(score.toFixed(1)),
    articulationScore: Number(articulationScore.toFixed(1)),
    writingScore: Number(writing.toFixed(1)),
    articulationWeight,
    writingWeight,
  };
}
