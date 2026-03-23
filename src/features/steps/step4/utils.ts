export const STEP4_IMAGE_BASE_URL = (
  process.env.NEXT_PUBLIC_STEP4_IMAGE_BASE_URL ||
  "https://cdn.jsdelivr.net/gh/BUGISU/braintalktalk-assets@main/step4"
).replace(/\/$/, "");

export const STEP4_IMAGE_RAW_BASE_URL = (
  process.env.NEXT_PUBLIC_STEP4_IMAGE_RAW_BASE_URL ||
  "https://raw.githubusercontent.com/BUGISU/braintalktalk-assets/main/step4"
).replace(/\/$/, "");

const STEP4_PLACE_TERMS = [
  "우리 집",
  "커피숍",
  "거실",
  "주방",
  "침실",
  "병원",
  "카페",
  "은행",
  "공원",
  "마트",
  "창구",
  "카운터",
  "매장",
];

export function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string) || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function maskPlaceLabels(text: string) {
  if (!text) return text;
  const sortedTerms = [...STEP4_PLACE_TERMS].sort((a, b) => b.length - a.length);
  let masked = text;
  for (const term of sortedTerms) {
    masked = masked.split(term).join("이곳");
  }
  return masked.replace(/(이곳\s*){2,}/g, "이곳 ");
}

type Step4ScoringInput = {
  matchedKeywordCount: number;
  totalKeywords: number;
  transcript: string;
  speechDurationSec: number;
  consonantAccuracy: number;
  vowelAccuracy: number;
  responseStartMs: number | null;
};

export type Step4ScoringBreakdown = {
  contentScore: number;
  fluencyScore: number;
  clarityScore: number;
  responseStartScore: number;
  finalScore: number;
  kwabScore: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function scoreStep4Response(input: Step4ScoringInput): Step4ScoringBreakdown {
  const {
    matchedKeywordCount,
    totalKeywords,
    transcript,
    speechDurationSec,
    consonantAccuracy,
    vowelAccuracy,
    responseStartMs,
  } = input;

  const normalizedTranscript = String(transcript || "").trim();
  const normalizedLength = normalizedTranscript.replace(/\s+/g, "").length;
  const contentScore = clamp(
    totalKeywords > 0
      ? (clamp(matchedKeywordCount, 0, totalKeywords) / totalKeywords) * 100
      : normalizedLength >= 8
        ? 70
        : 0,
    0,
    100,
  );

  const charsPerSec =
    speechDurationSec > 0 ? normalizedLength / Math.max(0.1, speechDurationSec) : 0;
  let speechRateScore = 0;
  if (charsPerSec > 0 && charsPerSec <= 1) {
    speechRateScore = 40 * charsPerSec;
  } else if (charsPerSec <= 2.8) {
    speechRateScore = 40 + ((charsPerSec - 1) / 1.8) * 60;
  } else {
    speechRateScore = 100 - Math.min(35, (charsPerSec - 2.8) * 25);
  }
  const hesitationCount =
    (normalizedTranscript.match(/(음|어|저기|그게|그거|...|…)/g) || []).length;
  const hesitationPenalty = Math.min(40, hesitationCount * 8);
  const hasSentenceEnding = /[.?!]$|[다요죠네]$/.test(normalizedTranscript);
  const sentenceBonus = hasSentenceEnding || normalizedLength >= 12 ? 10 : 0;
  const fluencyScore = clamp(speechRateScore - hesitationPenalty + sentenceBonus, 0, 100);

  const clarityScore = clamp((consonantAccuracy + vowelAccuracy) / 2, 0, 100);

  const responseStartScore =
    responseStartMs === null
      ? 50
      : responseStartMs <= 6000
        ? 100
        : responseStartMs >= 14000
          ? 0
          : clamp(100 - ((responseStartMs - 6000) / 8000) * 100, 0, 100);

  const finalScore = Number(
    (
      contentScore * 0.55 +
      fluencyScore * 0.2 +
      clarityScore * 0.15 +
      responseStartScore * 0.1
    ).toFixed(1),
  );
  const kwabScore = Number(clamp(finalScore / 10, 0, 10).toFixed(1));

  return {
    contentScore: Number(contentScore.toFixed(1)),
    fluencyScore: Number(fluencyScore.toFixed(1)),
    clarityScore: Number(clarityScore.toFixed(1)),
    responseStartScore: Number(responseStartScore.toFixed(1)),
    finalScore,
    kwabScore,
  };
}
