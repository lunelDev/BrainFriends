// src/utils/faceAnalysis.ts
// Face/lip metric extraction from MediaPipe FaceMesh landmarks.

const LIPS = {
  TOP: 13,
  BOTTOM: 14,
  LEFT: 61,
  RIGHT: 291,
  NOSE_TIP: 6,
};

// MediaPipe FaceLandmarker iris/eye landmark indices (refine landmarks 478-point model).
// Iris centers: 468 (right eye, subject's right = image left), 473 (left eye).
// Eye corners/lids are used to build a per-eye bounding box so that iris position can be
// normalised to a [-1, 1] gaze vector.
const GAZE = {
  RIGHT_IRIS_CENTER: 468,
  LEFT_IRIS_CENTER: 473,
  RIGHT_OUTER: 33,
  RIGHT_INNER: 133,
  RIGHT_UPPER: 159,
  RIGHT_LOWER: 145,
  LEFT_OUTER: 263,
  LEFT_INNER: 362,
  LEFT_UPPER: 386,
  LEFT_LOWER: 374,
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
  trackingQualityPct: number; // 0~100
  rollAngleDeg: number; // head tilt estimate
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
      trackingQualityPct: 0,
      rollAngleDeg: 0,
    };
  }

  const leftCheek = landmarks?.[234];
  const rightCheek = landmarks?.[454];
  const leftOuterEye = landmarks?.[33];
  const rightOuterEye = landmarks?.[263];
  const faceWidth = Math.max(
    0.001,
    Math.abs((rightCheek?.x ?? right.x) - (leftCheek?.x ?? left.x)),
  );
  const eyeDx = (rightOuterEye?.x ?? right.x) - (leftOuterEye?.x ?? left.x);
  const eyeDy = (rightOuterEye?.y ?? right.y) - (leftOuterEye?.y ?? left.y);
  const rollAngleRad = Math.atan2(eyeDy, eyeDx || 0.001);
  const rollAngleDeg = (rollAngleRad * 180) / Math.PI;
  const centerX = (leftCheek?.x ?? left.x) + faceWidth / 2;
  const centerY =
    ((leftCheek?.y ?? left.y) + (rightCheek?.y ?? right.y) + nose.y + top.y + bottom.y) /
    4;
  const rotatePoint = (point: { x: number; y: number }, cx: number, cy: number) => {
    const tx = point.x - cx;
    const ty = point.y - cy;
    const cos = Math.cos(-rollAngleRad);
    const sin = Math.sin(-rollAngleRad);
    return {
      x: tx * cos - ty * sin + cx,
      y: tx * sin + ty * cos + cy,
    };
  };
  const rotatedLeft = rotatePoint(left, centerX, centerY);
  const rotatedRight = rotatePoint(right, centerX, centerY);
  const rotatedTop = rotatePoint(top, centerX, centerY);
  const rotatedBottom = rotatePoint(bottom, centerX, centerY);

  const verticalDiff = Math.abs(rotatedLeft.y - rotatedRight.y);
  const symmetryScore = clamp(100 - verticalDiff * 1800, 0, 100);

  const openingRatio = Math.abs(rotatedBottom.y - rotatedTop.y) * 500;
  const mouthWidth = Math.abs(rotatedRight.x - rotatedLeft.x);

  const midX = nose.x;
  const leftDist = Math.abs(midX - left.x);
  const rightDist = Math.abs(right.x - midX);
  const deviation = (rightDist - leftDist) * 100;

  const leftBrow = landmarks?.[105];
  const rightBrow = landmarks?.[334];
  const rotatedLeftBrow = leftBrow ? rotatePoint(leftBrow, centerX, centerY) : null;
  const rotatedRightBrow = rightBrow
    ? rotatePoint(rightBrow, centerX, centerY)
    : null;
  const browAsym =
    rotatedLeftBrow && rotatedRightBrow
      ? Math.abs(rotatedLeftBrow.y - rotatedRightBrow.y)
      : 0;
  const staticSymmetryScore = clamp(100 - browAsym * 2200, 0, 100);

  const motionStrength = clamp(openingRatio / 35, 0, 1);
  const dynamicPenalty =
    Math.abs(verticalDiff - browAsym) * 1200 * motionStrength;
  const dynamicSymmetryScore = clamp(symmetryScore - dynamicPenalty, 0, 100);
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
  const noseOffsetX = Math.abs(nose.x - centerX) / faceWidth;
  const noseOffsetY = Math.abs(nose.y - centerY) / Math.max(faceWidth, 0.001);
  const faceAreaConfidence = clamp(faceWidth / 0.22, 0, 1);
  const centerConfidence = clamp(1 - noseOffsetX * 2.2 - noseOffsetY * 0.8, 0, 1);
  const rollConfidence = clamp(1 - Math.abs(rollAngleDeg) / 18, 0, 1);
  const trackingQualityPct = Number(
    (
      (faceAreaConfidence * 0.4 + centerConfidence * 0.35 + rollConfidence * 0.25) *
      100
    ).toFixed(1),
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
    trackingQualityPct,
    rollAngleDeg: Number(rollAngleDeg.toFixed(1)),
  };
};

// ============================================================================
// Gaze metrics
// ----------------------------------------------------------------------------
// 제품제안서 p.7 "5채널" 중 4번 보조 채널(시선 추적) 구현체.
// MediaPipe FaceLandmarker (478-point, refine landmarks) 의 iris 랜드마크를
// 기존 안면 추적 흐름에서 그대로 받아 추가 모델 없이 계산한다.
// 출력은 결정성(deterministic) 스칼라이며 SW V&V 결정성 테스트 대상이다.
// ============================================================================

export interface GazeMetrics {
  /** Subject 눈에서 홍채의 정규화 수평 위치. -1~+1, 양수=영상 우측. 양안 평균. */
  gazeX: number;
  /** 홍채 정규화 수직 위치. -1~+1, 양수=영상 하단. 양안 평균. */
  gazeY: number;
  /** 화면 중앙 응시 점수. 100=완전 정중앙. 0.3 이내는 dead-zone 으로 100 처리. */
  centeredScore: number;
  /** 단순 응시 기반 attention 점수. 추후 트래킹 품질 가중을 더할 수 있는 자리. */
  attentionScore: number;
  /** Iris 랜드마크(468/473 등) 가용 여부. refine landmarks 미적용 모델이면 false. */
  irisDetected: boolean;
}

const ZERO_GAZE: GazeMetrics = {
  gazeX: 0,
  gazeY: 0,
  centeredScore: 0,
  attentionScore: 0,
  irisDetected: false,
};

export const calculateGazeMetrics = (landmarks: any[]): GazeMetrics => {
  const rIris = landmarks?.[GAZE.RIGHT_IRIS_CENTER];
  const lIris = landmarks?.[GAZE.LEFT_IRIS_CENTER];
  const rOuter = landmarks?.[GAZE.RIGHT_OUTER];
  const rInner = landmarks?.[GAZE.RIGHT_INNER];
  const rUpper = landmarks?.[GAZE.RIGHT_UPPER];
  const rLower = landmarks?.[GAZE.RIGHT_LOWER];
  const lOuter = landmarks?.[GAZE.LEFT_OUTER];
  const lInner = landmarks?.[GAZE.LEFT_INNER];
  const lUpper = landmarks?.[GAZE.LEFT_UPPER];
  const lLower = landmarks?.[GAZE.LEFT_LOWER];

  if (
    !rIris ||
    !lIris ||
    !rOuter ||
    !rInner ||
    !rUpper ||
    !rLower ||
    !lOuter ||
    !lInner ||
    !lUpper ||
    !lLower
  ) {
    return { ...ZERO_GAZE };
  }

  const computeEyeGaze = (
    iris: { x: number; y: number },
    outer: { x: number; y: number },
    inner: { x: number; y: number },
    upper: { x: number; y: number },
    lower: { x: number; y: number },
  ) => {
    const cx = (outer.x + inner.x) / 2;
    const cy = (upper.y + lower.y) / 2;
    const halfW = Math.max(0.001, Math.abs(inner.x - outer.x) / 2);
    const halfH = Math.max(0.001, Math.abs(lower.y - upper.y) / 2);
    return {
      gx: (iris.x - cx) / halfW,
      gy: (iris.y - cy) / halfH,
    };
  };

  const right = computeEyeGaze(rIris, rOuter, rInner, rUpper, rLower);
  const left = computeEyeGaze(lIris, lOuter, lInner, lUpper, lLower);

  const gazeX = clamp((right.gx + left.gx) / 2, -1.5, 1.5);
  const gazeY = clamp((right.gy + left.gy) / 2, -1.5, 1.5);

  // Dead zone 0.3 이내는 정중앙으로 간주, 그 이후 0.7 까지 선형 감점.
  const distance = Math.hypot(gazeX, gazeY);
  const adjusted = Math.max(0, distance - 0.3);
  const centeredScore = clamp(100 * (1 - adjusted / 0.7), 0, 100);

  return {
    gazeX: Number(gazeX.toFixed(3)),
    gazeY: Number(gazeY.toFixed(3)),
    centeredScore: Number(centeredScore.toFixed(1)),
    attentionScore: Number(centeredScore.toFixed(1)),
    irisDetected: true,
  };
};
