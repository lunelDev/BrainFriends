export const STT_PROMPT_VERSION = "ko-rehab-vocab-prompt-v1";

export function hashSttPrompt(prompt: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < prompt.length; i += 1) {
    hash ^= prompt.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").repeat(2).slice(0, 16);
}

const DOMAIN_TERMS = [
  "사과",
  "기차",
  "학교",
  "바다",
  "가족",
  "병원",
  "화장실",
  "도와주세요",
  "아파요",
  "물",
  "밥",
  "약",
  "말하기",
  "따라 말하기",
  "실어증",
  "조음",
];

function splitTerms(text: string) {
  return text
    .split(/[\s,.;:!?()[\]{}'"`~]+/g)
    .map((term) => term.trim())
    .filter((term) => term.length > 0);
}

export function buildKoreanSttPrompt(targetText?: string) {
  const terms = new Set<string>();
  for (const term of DOMAIN_TERMS) terms.add(term);
  for (const term of splitTerms(targetText ?? "")) terms.add(term);
  return Array.from(terms).slice(0, 80).join(", ");
}
