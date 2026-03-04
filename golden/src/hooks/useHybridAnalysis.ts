"use client";

import { useState } from "react";
import { LipMetrics } from "@/utils/faceAnalysis";

export interface MetricsData {
  latencyMs: number;
  facePrecisionMm: number;
  speechAccuracyPct: number;
  clinicalR: number;
  icc: number;
  stabilityPct: number;
  voiceVolume: number;
  consonantAcc: number;
  vowelAcc: number;
  face: LipMetrics;
}

const INITIAL_METRICS: MetricsData = {
  latencyMs: 0,
  facePrecisionMm: 0,
  speechAccuracyPct: 0,
  clinicalR: 0,
  icc: 0,
  stabilityPct: 0,
  voiceVolume: 0,
  consonantAcc: 0,
  vowelAcc: 0,
  face: {
    symmetryScore: 100,
    openingRatio: 0,
    mouthWidth: 0,
    isStretched: false,
    deviation: 0,
    staticSymmetryScore: 100,
    dynamicSymmetryScore: 100,
    eyebrowLiftPct: 0,
    eyeClosureStrengthPct: 0,
  },
};

export function useHybridAnalysis() {
  const [metrics, setMetrics] = useState<MetricsData>(INITIAL_METRICS);

  // 안면 데이터 실시간 업데이트 함수
  const updateFaceMetrics = (faceData: LipMetrics) => {
    setMetrics((prev) => ({
      ...prev,
      face: faceData,
    }));
  };

  return {
    metrics,
    setMetrics, // ✅ 외부에서 자음/모음 점수를 넣기 위해 반드시 리턴
    updateFaceMetrics,
  };
}
