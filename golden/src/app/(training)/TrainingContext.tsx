"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

interface ClinicalMetrics {
  systemLatency: number;
  trackingPrecision: number;
  analysisAccuracy: number;
  correlation: number;
  reliability: number;
  stability: number;
}

interface RuntimeStatus {
  recording: boolean;
  saving: boolean;
  pageError: boolean;
  needsRetry: boolean;
  message: string;
}

interface SidebarMetrics {
  facialSymmetry: number;
  staticFacialSymmetry: number;
  dynamicFacialSymmetry: number;
  mouthOpening: number;
  mouthWidth: number;
  eyebrowLift: number;
  eyeClosureStrength: number;
  vowelAccuracy: number;
  consonantAccuracy: number;
  consonantClosureRate: number; // 자음-폐쇄율 (%)
  consonantClosureHoldScore: number; // 자음-폐쇄 유지시간 점수 (%)
  consonantLipSymmetry: number; // 자음-좌우 대칭 점수 (%)
  consonantOpeningSpeedScore: number; // 자음-개방 속도 점수 (%)
  consonantClosureHoldMs: number; // 자음-폐쇄 유지시간 원값 (ms)
  consonantOpeningSpeedMs: number; // 자음-개방 속도 원값 (ms)
  vowelMouthOpening: number; // 모음-입벌림 (%)
  vowelMouthWidth: number; // 모음-입술 너비 (%)
  vowelRounding: number; // 모음-둥글림 (%)
  vowelPatternMatch: number; // 모음-목표 패턴 일치도 (%)
  faceDetected: boolean;
  cameraActive: boolean;
  landmarks?: any[];
}

interface TrainingContextType {
  clinicalMetrics: ClinicalMetrics;
  sidebarMetrics: SidebarMetrics;
  runtimeStatus: RuntimeStatus;
  updateClinical: (data: Partial<ClinicalMetrics>) => void;
  updateSidebar: (data: Partial<SidebarMetrics>) => void;
  updateRuntimeStatus: (data: Partial<RuntimeStatus>) => void;
  resetRuntimeStatus: () => void;
}

const TrainingContext = createContext<TrainingContextType | undefined>(
  undefined,
);

export function TrainingProvider({ children }: { children: React.ReactNode }) {
  const [clinicalMetrics, setClinicalMetrics] = useState<ClinicalMetrics>({
    systemLatency: 0,
    trackingPrecision: 0,
    analysisAccuracy: 95.2,
    correlation: 0.85,
    reliability: 0.8,
    stability: 0,
  });

  const [sidebarMetrics, setSidebarMetrics] = useState<SidebarMetrics>({
    facialSymmetry: 0,
    staticFacialSymmetry: 0,
    dynamicFacialSymmetry: 0,
    mouthOpening: 0,
    mouthWidth: 0,
    eyebrowLift: 0,
    eyeClosureStrength: 0,
    vowelAccuracy: 0,
    consonantAccuracy: 0,
    consonantClosureRate: 0,
    consonantClosureHoldScore: 0,
    consonantLipSymmetry: 0,
    consonantOpeningSpeedScore: 0,
    consonantClosureHoldMs: 0,
    consonantOpeningSpeedMs: 0,
    vowelMouthOpening: 0,
    vowelMouthWidth: 0,
    vowelRounding: 0,
    vowelPatternMatch: 0,
    faceDetected: false,
    cameraActive: false,
    landmarks: [],
  });

  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>({
    recording: false,
    saving: false,
    pageError: false,
    needsRetry: false,
    message: "",
  });

  const updateClinical = useCallback((data: Partial<ClinicalMetrics>) => {
    setClinicalMetrics((prev) => ({ ...prev, ...data }));
  }, []);

  const updateSidebar = useCallback((data: Partial<SidebarMetrics>) => {
    setSidebarMetrics((prev) => ({ ...prev, ...data }));
  }, []);

  const updateRuntimeStatus = useCallback((data: Partial<RuntimeStatus>) => {
    setRuntimeStatus((prev) => ({ ...prev, ...data }));
  }, []);

  const resetRuntimeStatus = useCallback(() => {
    setRuntimeStatus({
      recording: false,
      saving: false,
      pageError: false,
      needsRetry: false,
      message: "",
    });
  }, []);

  return (
    <TrainingContext.Provider
      value={{
        clinicalMetrics,
        sidebarMetrics,
        runtimeStatus,
        updateClinical,
        updateSidebar,
        updateRuntimeStatus,
        resetRuntimeStatus,
      }}
    >
      {children}
    </TrainingContext.Provider>
  );
}

export const useTraining = () => {
  const context = useContext(TrainingContext);
  if (!context)
    throw new Error("useTraining must be used within a TrainingProvider");
  return context;
};
