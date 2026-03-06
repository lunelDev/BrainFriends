import { PlaceType } from "@/constants/trainingData";
import { VISUAL_MATCHING_IMAGE_FILENAME_MAP } from "@/constants/visualTrainingData";

const STEP3_IMAGE_BASE_URL = (
  process.env.NEXT_PUBLIC_STEP3_IMAGE_BASE_URL ||
  "https://cdn.jsdelivr.net/gh/BUGISU/braintalktalk-assets@main/step3"
).replace(/\/$/, "");

const STEP6_IMAGE_LABEL_OVERRIDES: Partial<Record<PlaceType, Record<string, string>>> = {};

function buildNameVariants(baseName: string) {
  const variants = new Set<string>();
  variants.add(baseName);
  variants.add(baseName.replace(/-/g, ""));
  variants.add(baseName.replace(/-/g, "_"));
  variants.add(baseName.split("-")[0]);
  return Array.from(variants).filter(Boolean);
}

export function buildStep6ImageCandidates(place: PlaceType, answer: string): string[] {
  const candidates: string[] = [];
  const resolvedLabel = STEP6_IMAGE_LABEL_OVERRIDES[place]?.[answer] || answer;
  const mappedBaseName = VISUAL_MATCHING_IMAGE_FILENAME_MAP[place]?.[resolvedLabel];

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
    `${STEP3_IMAGE_BASE_URL}/${place}/${encodeURIComponent(resolvedLabel)}.png`,
    `${STEP3_IMAGE_BASE_URL}/${place}/${encodeURIComponent(resolvedLabel)}.jpg`,
    `${STEP3_IMAGE_BASE_URL}/${place}/${encodeURIComponent(resolvedLabel)}.jpeg`,
    `${STEP3_IMAGE_BASE_URL}/${place}/${encodeURIComponent(resolvedLabel)}.webp`,
    `${STEP3_IMAGE_BASE_URL}/${encodeURIComponent(resolvedLabel)}.png`,
    `${STEP3_IMAGE_BASE_URL}/${encodeURIComponent(resolvedLabel)}.jpg`,
    `${STEP3_IMAGE_BASE_URL}/${encodeURIComponent(resolvedLabel)}.jpeg`,
    `${STEP3_IMAGE_BASE_URL}/${encodeURIComponent(resolvedLabel)}.webp`,
    `/images/places/${place}.png`,
  );

  return Array.from(new Set(candidates));
}

export function getResultWordSizeClass(word: string) {
  const len = (word || "").trim().length;
  if (len <= 3) return "text-5xl sm:text-6xl lg:text-8xl";
  if (len <= 5) return "text-4xl sm:text-5xl lg:text-7xl";
  if (len <= 8) return "text-3xl sm:text-4xl lg:text-6xl";
  return "text-2xl sm:text-3xl lg:text-5xl";
}

export function getTracingGuideFontSize(
  answer: string,
  canvasWidth: number,
  canvasHeight: number,
) {
  const len = Math.max(1, (answer || "").trim().length);
  const widthBased = canvasWidth / Math.max(2.2, len * 1.15);
  const heightBased = canvasHeight * 0.5;
  return Math.max(28, Math.min(widthBased, heightBased));
}

function getInkMaskFromImageData(
  imageData: ImageData,
  alphaThreshold = 12,
  luminanceThreshold = 240,
) {
  const { data, width, height } = imageData;
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const a = data[offset + 3];
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (a > alphaThreshold && lum < luminanceThreshold) {
      mask[i] = 1;
    }
  }
  return mask;
}

function getTextTemplateMask(answer: string, width: number, height: number): Uint8Array {
  const off = document.createElement("canvas");
  off.width = width;
  off.height = height;
  const ctx = off.getContext("2d");
  if (!ctx) return new Uint8Array(width * height);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${getTracingGuideFontSize(answer, width, height)}px 'Noto Sans KR', sans-serif`;
  ctx.fillText(answer, width / 2, height / 2);
  const image = ctx.getImageData(0, 0, width, height);
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const a = image.data[i * 4 + 3];
    if (a > 12) mask[i] = 1;
  }
  return mask;
}

export function calculateShapeSimilarityPct(canvas: HTMLCanvasElement, answer: string): number {
  const ctx = canvas.getContext("2d");
  if (!ctx) return 0;
  const { width, height } = canvas;
  if (width <= 0 || height <= 0) return 0;

  const userImage = ctx.getImageData(0, 0, width, height);
  const userMask = getInkMaskFromImageData(userImage);
  const templateMask = getTextTemplateMask(answer, width, height);

  let userCount = 0;
  let templateCount = 0;
  let intersection = 0;
  for (let i = 0; i < userMask.length; i += 1) {
    const u = userMask[i] === 1;
    const t = templateMask[i] === 1;
    if (u) userCount += 1;
    if (t) templateCount += 1;
    if (u && t) intersection += 1;
  }

  if (userCount === 0 || templateCount === 0) return 0;

  const recall = intersection / templateCount;
  const precision = intersection / userCount;
  const overlapScore = (recall * 0.7 + precision * 0.3) * 100;

  const getBox = (mask: Uint8Array) => {
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = y * width + x;
        if (mask[idx] !== 1) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0 || maxY < 0) return null;
    const w = Math.max(1, maxX - minX + 1);
    const h = Math.max(1, maxY - minY + 1);
    return { w, h };
  };

  const userBox = getBox(userMask);
  const templateBox = getBox(templateMask);
  if (!userBox || !templateBox) {
    return Math.max(0, Math.min(100, Number(overlapScore.toFixed(1))));
  }

  const userAspect = userBox.w / userBox.h;
  const templateAspect = templateBox.w / templateBox.h;
  const aspectRatioDelta = Math.abs(Math.log((userAspect + 1e-6) / (templateAspect + 1e-6)));
  const aspectScore = Math.max(0, 100 - aspectRatioDelta * 65);

  const userDensity = userCount / (userBox.w * userBox.h);
  const templateDensity = templateCount / (templateBox.w * templateBox.h);
  const densityDelta = Math.abs(userDensity - templateDensity);
  const densityScore = Math.max(0, 100 - densityDelta * 260);

  const robustScore = aspectScore * 0.55 + densityScore * 0.45;
  const finalScore = overlapScore * 0.55 + robustScore * 0.45;
  return Math.max(0, Math.min(100, Number(finalScore.toFixed(1))));
}

export function isQuotaExceededError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === "QuotaExceededError" || error.code === 22;
  }
  if (typeof error === "object" && error !== null && "name" in error) {
    return (error as { name?: string }).name === "QuotaExceededError";
  }
  return false;
}

export function toCompressedDataUrl(canvas: HTMLCanvasElement): string {
  const targetW = Math.max(220, Math.floor(canvas.width * 0.38));
  const targetH = Math.max(140, Math.floor(canvas.height * 0.38));
  const off = document.createElement("canvas");
  off.width = targetW;
  off.height = targetH;
  const ctx = off.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/jpeg", 0.6);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.drawImage(canvas, 0, 0, targetW, targetH);
  return off.toDataURL("image/jpeg", 0.62);
}
