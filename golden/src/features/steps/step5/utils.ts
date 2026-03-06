export function getStep5TextSizeClass(text: string): string {
  const normalizedLength = (text || "").replace(/\s+/g, "").length;
  if (normalizedLength >= 110) return "text-xs md:text-sm lg:text-base";
  if (normalizedLength >= 85) return "text-sm md:text-base lg:text-lg";
  if (normalizedLength >= 60) return "text-base md:text-lg lg:text-xl";
  if (normalizedLength >= 40) return "text-lg md:text-xl lg:text-2xl";
  return "text-xl md:text-2xl lg:text-3xl";
}

export function blendArticulationAccuracy(
  visualAccuracy: number,
  speechAccuracy?: number,
): number {
  if (!Number.isFinite(speechAccuracy) || Number(speechAccuracy) <= 0) {
    return Math.min(100, Math.max(0, visualAccuracy));
  }
  return Math.min(
    100,
    Math.max(0, visualAccuracy * 0.2 + Number(speechAccuracy) * 0.8),
  );
}
