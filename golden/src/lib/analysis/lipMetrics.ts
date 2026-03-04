function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function estimateLipSymmetryFromLandmarks(landmarks?: any[]): number {
  const leftMouth = landmarks?.[61];
  const rightMouth = landmarks?.[291];
  const leftCheek = landmarks?.[234];
  const rightCheek = landmarks?.[454];
  if (!leftMouth || !rightMouth || !leftCheek || !rightCheek) return 0.5;

  const faceWidth = Math.max(0.001, Math.abs(rightCheek.x - leftCheek.x));
  const lipTiltNorm = Math.abs(rightMouth.y - leftMouth.y) / faceWidth;

  // 0%: tilt >= 6%, 100%: tilt ~= 0%
  const symmetryPct = clamp((1 - lipTiltNorm / 0.06) * 100, 0, 100);
  return symmetryPct / 100;
}

