// src/utils/faceAnalysis.ts
// Face/lip metric extraction from MediaPipe FaceMesh landmarks.

const LIPS = {
  TOP: 13,
  BOTTOM: 14,
  LEFT: 61,
  RIGHT: 291,
  NOSE_TIP: 6,
};

export interface LipMetrics {
  symmetryScore: number; // 0~100
  openingRatio: number; // 0~100+
  mouthWidth: number; // normalized 0~1
  isStretched: boolean;
  deviation: number; // signed left-right deviation
  staticSymmetryScore: number; // brow/static symmetry
  dynamicSymmetryScore: number; // articulation/dynamic symmetry
  eyebrowLiftPct: number; // upper-face metric
  eyeClosureStrengthPct: number; // upper-face metric
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export const calculateLipMetrics = (landmarks: any[]): LipMetrics => {
  const top = landmarks?.[LIPS.TOP];
  const bottom = landmarks?.[LIPS.BOTTOM];
  const left = landmarks?.[LIPS.LEFT];
  const right = landmarks?.[LIPS.RIGHT];
  const nose = landmarks?.[LIPS.NOSE_TIP];

  if (!top || !bottom || !left || !right || !nose) {
    return {
      symmetryScore: 0,
      openingRatio: 0,
      mouthWidth: 0,
      isStretched: false,
      deviation: 0,
      staticSymmetryScore: 0,
      dynamicSymmetryScore: 0,
      eyebrowLiftPct: 0,
      eyeClosureStrengthPct: 0,
    };
  }

  const leftCheek = landmarks?.[234];
  const rightCheek = landmarks?.[454];

  const verticalDiff = Math.abs(left.y - right.y);
  const symmetryScore = clamp(100 - verticalDiff * 2500, 0, 100);

  const openingRatio = Math.abs(bottom.y - top.y) * 500;
  const mouthWidth = Math.abs(right.x - left.x);

  const midX = nose.x;
  const leftDist = Math.abs(midX - left.x);
  const rightDist = Math.abs(right.x - midX);
  const deviation = (rightDist - leftDist) * 100;

  const leftBrow = landmarks?.[105];
  const rightBrow = landmarks?.[334];
  const browAsym =
    leftBrow && rightBrow ? Math.abs(leftBrow.y - rightBrow.y) : 0;
  const staticSymmetryScore = clamp(100 - browAsym * 2800, 0, 100);

  const motionStrength = clamp(openingRatio / 35, 0, 1);
  const dynamicPenalty =
    Math.abs(verticalDiff - browAsym) * 1800 * motionStrength;
  const dynamicSymmetryScore = clamp(symmetryScore - dynamicPenalty, 0, 100);

  const faceWidth = Math.max(
    0.001,
    Math.abs((rightCheek?.x ?? right.x) - (leftCheek?.x ?? left.x)),
  );
  const browLiftSpan =
    leftBrow && rightBrow
      ? (nose.y - leftBrow.y + (nose.y - rightBrow.y)) / 2
      : 0;
  const eyebrowLiftPct = clamp(
    (browLiftSpan / (faceWidth * 0.34)) * 100,
    0,
    100,
  );

  const leftUpperEye = landmarks?.[159];
  const leftLowerEye = landmarks?.[145];
  const rightUpperEye = landmarks?.[386];
  const rightLowerEye = landmarks?.[374];
  const leftOuterEye = landmarks?.[33];
  const rightOuterEye = landmarks?.[263];

  const leftEyeGap =
    leftUpperEye && leftLowerEye
      ? Math.abs(leftLowerEye.y - leftUpperEye.y)
      : 0;
  const rightEyeGap =
    rightUpperEye && rightLowerEye
      ? Math.abs(rightLowerEye.y - rightUpperEye.y)
      : 0;
  const eyeGapAvg = (leftEyeGap + rightEyeGap) / 2;
  const eyeReference =
    leftOuterEye && rightOuterEye
      ? Math.abs(rightOuterEye.x - leftOuterEye.x)
      : faceWidth * 0.22;
  const normalizedEyeGap = eyeReference > 0 ? eyeGapAvg / eyeReference : 0;
  const eyeClosureStrengthPct = clamp(
    ((0.055 - normalizedEyeGap) / 0.055) * 100,
    0,
    100,
  );

  return {
    symmetryScore: Number(symmetryScore.toFixed(1)),
    openingRatio: Number(openingRatio.toFixed(1)),
    mouthWidth: Number(mouthWidth.toFixed(3)),
    isStretched: mouthWidth > 0.15,
    deviation: Number(deviation.toFixed(2)),
    staticSymmetryScore: Number(staticSymmetryScore.toFixed(1)),
    dynamicSymmetryScore: Number(dynamicSymmetryScore.toFixed(1)),
    eyebrowLiftPct: Number(eyebrowLiftPct.toFixed(1)),
    eyeClosureStrengthPct: Number(eyeClosureStrengthPct.toFixed(1)),
  };
};
