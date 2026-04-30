import type { PlaceType } from "@/constants/trainingData";

export type AacTrainingCommit = {
  place: PlaceType;
  symbolIds: string[];
  sentence: string;
};

export type AacTrainingMetadata = {
  inputModality: "aac";
  aacSymbolIds: string[];
  aacSentence: string;
  aacPlace: PlaceType;
};

export function normalizeAacComparableText(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

export function scoreAacTranscriptMatch(params: {
  targetText: string;
  sentence: string;
}) {
  const target = normalizeAacComparableText(params.targetText);
  const sentence = normalizeAacComparableText(params.sentence);
  if (!sentence) return 0;
  if (!target) return 60;
  if (target === sentence) return 100;
  if (target.includes(sentence) || sentence.includes(target)) return 85;

  const targetChars = new Set(Array.from(target));
  const sentenceChars = new Set(Array.from(sentence));
  if (targetChars.size === 0) return 0;
  let overlap = 0;
  sentenceChars.forEach((char) => {
    if (targetChars.has(char)) overlap += 1;
  });
  return Math.round(Math.max(20, Math.min(80, (overlap / targetChars.size) * 80)));
}

export function buildAacTrainingMetadata(
  payload: AacTrainingCommit,
): AacTrainingMetadata {
  return {
    inputModality: "aac",
    aacSymbolIds: [...payload.symbolIds],
    aacSentence: payload.sentence,
    aacPlace: payload.place,
  };
}

export async function persistAacIntentBestEffort(payload: AacTrainingCommit) {
  try {
    await fetch("/api/aac/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // AAC intent log 저장 실패가 훈련 흐름을 막으면 안 된다.
  }
}
