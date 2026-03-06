import { PlaceType } from "@/constants/trainingData";
import { VISUAL_MATCHING_IMAGE_FILENAME_MAP } from "@/constants/visualTrainingData";

export type Step3VisualOption = {
  id: string;
  label: string;
  img?: string;
  emoji?: string;
};

const STEP3_IMAGE_BASE_URL = (
  process.env.NEXT_PUBLIC_STEP3_IMAGE_BASE_URL ||
  "https://cdn.jsdelivr.net/gh/BUGISU/braintalktalk-assets@main/step3"
).replace(/\/$/, "");

function toTwemojiSvgUrl(emoji: string) {
  const codePoints = Array.from(emoji).map((char) => char.codePointAt(0)?.toString(16));
  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${codePoints.join("-")}.svg`;
}

function buildNameVariants(baseName: string) {
  const variants = new Set<string>();
  variants.add(baseName);
  variants.add(baseName.replace(/-/g, ""));
  variants.add(baseName.replace(/-/g, "_"));
  variants.add(baseName.split("-")[0]);
  return Array.from(variants).filter(Boolean);
}

export function buildImageCandidates(place: PlaceType, option: Step3VisualOption): string[] {
  const candidates: string[] = [];

  if (option.img) candidates.push(option.img);

  const mappedBaseName = VISUAL_MATCHING_IMAGE_FILENAME_MAP[place]?.[option.label];
  if (mappedBaseName) {
    for (const nameVariant of buildNameVariants(mappedBaseName)) {
      candidates.push(
        `${STEP3_IMAGE_BASE_URL}/${place}/${nameVariant}.png`,
        `${STEP3_IMAGE_BASE_URL}/${place}/${nameVariant}.jpg`,
        `${STEP3_IMAGE_BASE_URL}/${place}/${nameVariant}.jpeg`,
        `${STEP3_IMAGE_BASE_URL}/${place}/${nameVariant}.webp`,
        `${STEP3_IMAGE_BASE_URL}/${nameVariant}.png`,
        `${STEP3_IMAGE_BASE_URL}/${nameVariant}.jpg`,
        `${STEP3_IMAGE_BASE_URL}/${nameVariant}.jpeg`,
        `${STEP3_IMAGE_BASE_URL}/${nameVariant}.webp`,
      );
    }
  }

  candidates.push(
    `${STEP3_IMAGE_BASE_URL}/${place}/${encodeURIComponent(option.label)}.png`,
    `${STEP3_IMAGE_BASE_URL}/${place}/${encodeURIComponent(option.label)}.jpg`,
    `${STEP3_IMAGE_BASE_URL}/${place}/${encodeURIComponent(option.label)}.jpeg`,
    `${STEP3_IMAGE_BASE_URL}/${place}/${encodeURIComponent(option.label)}.webp`,
    `${STEP3_IMAGE_BASE_URL}/${encodeURIComponent(option.label)}.png`,
    `${STEP3_IMAGE_BASE_URL}/${encodeURIComponent(option.label)}.jpg`,
    `${STEP3_IMAGE_BASE_URL}/${encodeURIComponent(option.label)}.jpeg`,
    `${STEP3_IMAGE_BASE_URL}/${encodeURIComponent(option.label)}.webp`,
  );

  if (option.emoji) candidates.push(toTwemojiSvgUrl(option.emoji));

  return Array.from(new Set(candidates.filter(Boolean)));
}

export function shuffleArray<T>(arr: T[]): T[] {
  const next = [...arr];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}
