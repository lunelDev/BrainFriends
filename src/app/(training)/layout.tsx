"use client";

import React, { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { TrainingProvider, useTraining } from "./TrainingContext";
import FaceTracker from "@/components/diagnosis/FaceTracker";
import { DeveloperKpiPanel } from "@/components/training/DeveloperKpiPanel";
import { stopRegisteredMediaStreams } from "@/lib/client/mediaStreamRegistry";

function stopAllAttachedMediaStreams() {
  if (typeof document === "undefined") return;

  stopRegisteredMediaStreams();

  const mediaElements = Array.from(
    document.querySelectorAll("video, audio"),
  ) as Array<HTMLVideoElement | HTMLAudioElement>;

  for (const element of mediaElements) {
    const stream = element.srcObject;
    if (stream instanceof MediaStream) {
      stream.getTracks().forEach((track) => track.stop());
      element.srcObject = null;
    }
  }
}

function TrainingLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isReportRoute = pathname === "/report";
  const isProgramRoute = pathname.startsWith("/programs/");
  const isLingoRoute = pathname.startsWith("/programs/lingo/");
  const cameraEnabledProgramRoutes = new Set([
    "/programs/step-2",
    "/programs/step-4",
    "/programs/step-5",
    "/programs/sing-training",
  ]);
  const showLiveTrainingChrome =
    isProgramRoute &&
    !isReportRoute &&
    !isLingoRoute &&
    cameraEnabledProgramRoutes.has(pathname);
  const {
    clinicalMetrics,
    sidebarMetrics,
    runtimeStatus,
    updateClinical,
    updateSidebar,
    updateRuntimeStatus,
  } = useTraining();

  // ✅ 엔진용 Refs (화면에는 보이지 않으며 좌표 추출용으로만 사용)
  const engineVideoRef = useRef<HTMLVideoElement>(null);
  const engineCanvasRef = useRef<HTMLCanvasElement>(null);
  const prevLandmarksRef = useRef<any[] | null>(null);
  const latencyEmaRef = useRef(0);
  const precisionEmaRef = useRef(0);
  const fpsEmaRef = useRef(0);
  const precisionHistoryRef = useRef<number[]>([]);

  const getStatusColor = (
    current: number,
    target: number,
    isMin: boolean = true,
  ) => {
    const isPass = isMin ? current >= target : current <= target;
    return isPass ? "text-emerald-500" : "text-orange-400";
  };

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      updateRuntimeStatus({
        pageError: true,
        needsRetry: true,
        message: event.message || "페이지 오류가 발생했습니다. 다시 실행해 주세요.",
      });
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason =
        typeof event.reason === "string"
          ? event.reason
          : event.reason?.message || "비동기 처리 오류가 발생했습니다.";
      updateRuntimeStatus({
        pageError: true,
        needsRetry: true,
        message: reason,
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [updateRuntimeStatus]);

  useEffect(() => {
    if (showLiveTrainingChrome || isLingoRoute) return;

    stopAllAttachedMediaStreams();

    prevLandmarksRef.current = null;
    latencyEmaRef.current = 0;
    precisionEmaRef.current = 0;
    fpsEmaRef.current = 0;
    precisionHistoryRef.current = [];

    updateClinical({
      systemLatency: 0,
      trackingPrecision: 0,
      analysisAccuracy: 95.2,
      correlation: 0.85,
      reliability: 0.8,
      stability: 0,
    });

    updateSidebar({
      facialSymmetry: 0,
      staticFacialSymmetry: 0,
      dynamicFacialSymmetry: 0,
      mouthOpening: 0,
      mouthWidth: 0,
      eyebrowLift: 0,
      eyeClosureStrength: 0,
      faceDetected: false,
      cameraActive: false,
      landmarks: [],
    });

    updateRuntimeStatus({
      recording: false,
      saving: false,
      pageError: false,
      needsRetry: false,
      message: "",
    });
  }, [
    isLingoRoute,
    showLiveTrainingChrome,
    updateClinical,
    updateSidebar,
    updateRuntimeStatus,
  ]);

  useEffect(() => {
    if (!showLiveTrainingChrome) return;
    if (runtimeStatus.pageError || runtimeStatus.needsRetry || runtimeStatus.saving) return;

    const trackingQualityPct = Number(sidebarMetrics.trackingQuality || 0) * 100;
    const landmarkCount = Array.isArray(sidebarMetrics.landmarks)
      ? sidebarMetrics.landmarks.length
      : 0;

    if (!sidebarMetrics.cameraActive || landmarkCount === 0 || trackingQualityPct < 15) {
      updateRuntimeStatus({
        message: "카메라 초기화 중입니다. 권한과 장치 연결 상태를 확인해 주세요.",
      });
      return;
    }

    if (!sidebarMetrics.faceDetected || trackingQualityPct < 55) {
      updateRuntimeStatus({
        message: "얼굴을 화면 중앙에 맞추고 조명과 카메라 각도를 조정해 주세요.",
      });
      return;
    }

    if (runtimeStatus.message) {
      updateRuntimeStatus({ message: "" });
    }
  }, [
    showLiveTrainingChrome,
    runtimeStatus.pageError,
    runtimeStatus.needsRetry,
    runtimeStatus.saving,
    runtimeStatus.message,
    sidebarMetrics.cameraActive,
    sidebarMetrics.faceDetected,
    sidebarMetrics.landmarks,
    sidebarMetrics.trackingQuality,
    updateRuntimeStatus,
  ]);

  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

  const ema = (prev: number, next: number, alpha = 0.2) =>
    prev === 0 ? next : prev * (1 - alpha) + next * alpha;

  const avgDistance = (a: any[], b: any[], points: number[]) => {
    let sum = 0;
    let count = 0;
    for (const idx of points) {
      const pa = a?.[idx];
      const pb = b?.[idx];
      if (!pa || !pb) continue;
      const dx = (pb.x ?? 0) - (pa.x ?? 0);
      const dy = (pb.y ?? 0) - (pa.y ?? 0);
      sum += Math.hypot(dx, dy);
      count += 1;
    }
    return count > 0 ? sum / count : 0;
  };

  return (
    <div className="training-print-root min-h-screen lg:h-screen w-full bg-[#F3F4F6] overflow-y-auto lg:overflow-hidden">
      <div className="training-print-shell w-full min-h-screen lg:h-screen bg-white flex flex-col overflow-y-auto lg:overflow-hidden relative">
        <div className="training-print-content flex-1 flex flex-col overflow-y-auto lg:overflow-hidden bg-[#ffffff]">
          {children}
        </div>
        <DeveloperKpiPanel />

        {/* ✅ 백그라운드 AI 엔진: 좌표만 추출하여 Context에 저장 */}
        {showLiveTrainingChrome && (
          <div className="fixed opacity-0 pointer-events-none -z-50 w-0 h-0">
          <FaceTracker
            videoRef={engineVideoRef}
            canvasRef={engineCanvasRef}
            onReady={() => updateSidebar({ cameraActive: true })}
            onMetricsUpdate={(m: any) => {
              const faceDetected = Boolean(m.faceDetected);
              const landmarks = Array.isArray(m.landmarks) ? m.landmarks : [];

              updateSidebar({
                facialSymmetry: m.symmetryScore / 100,
                staticFacialSymmetry: (m.staticSymmetryScore || m.symmetryScore) / 100,
                dynamicFacialSymmetry:
                  (m.dynamicSymmetryScore || m.symmetryScore) / 100,
                mouthOpening: (m.openingRatio || 0) / 100,
                mouthWidth: m.mouthWidth || 0,
                eyebrowLift: (m.eyebrowLiftPct || 0) / 100,
                eyeClosureStrength: (m.eyeClosureStrengthPct || 0) / 100,
                trackingQuality: (m.trackingQualityPct || 0) / 100,
                faceDetected,
                landmarks, // Context로 좌표 전달
              });

              if (!faceDetected || landmarks.length === 0) {
                prevLandmarksRef.current = null;
                return;
              }

              const processingMs = Number(m.processingMs || 0);
              const frameFps = Number(m.fps || 0);
              const prev = prevLandmarksRef.current;
              const points = [6, 13, 14, 33, 61, 159, 263, 291, 374, 386];

              let precisionMm = precisionEmaRef.current || 0;
              if (prev && prev.length > 0) {
                const movementNorm = avgDistance(prev, landmarks, points);
                const leftCheek = landmarks[234];
                const rightCheek = landmarks[454];
                const faceWidthNorm =
                  leftCheek && rightCheek
                    ? Math.max(0.001, Math.abs((rightCheek.x ?? 0) - (leftCheek.x ?? 0)))
                    : 0.12;
                precisionMm = (movementNorm / faceWidthNorm) * 140;
              }
              prevLandmarksRef.current = landmarks;

              latencyEmaRef.current = ema(latencyEmaRef.current, processingMs, 0.2);
              precisionEmaRef.current = ema(
                precisionEmaRef.current,
                clamp(precisionMm, 0, 2.5),
                0.18,
              );
              fpsEmaRef.current = ema(fpsEmaRef.current, frameFps, 0.18);

              const history = precisionHistoryRef.current;
              history.push(precisionEmaRef.current);
              if (history.length > 40) history.shift();
              const mean =
                history.reduce((sum, v) => sum + v, 0) / Math.max(1, history.length);
              const variance =
                history.reduce((sum, v) => sum + (v - mean) ** 2, 0) /
                Math.max(1, history.length);
              const std = Math.sqrt(variance);
              const stabilityPct = clamp((std / Math.max(0.05, mean)) * 100, 0, 30);

              const precisionQuality = clamp(1 - precisionEmaRef.current / 0.8, 0, 1);
              const latencyQuality = clamp(1 - latencyEmaRef.current / 80, 0, 1);
              const fpsQuality = clamp((fpsEmaRef.current - 10) / 20, 0, 1);
              const overallQuality =
                precisionQuality * 0.45 + latencyQuality * 0.35 + fpsQuality * 0.2;

              updateClinical({
                systemLatency: Number(clamp(latencyEmaRef.current, 0, 999).toFixed(0)),
                trackingPrecision: Number(
                  clamp(precisionEmaRef.current, 0, 9.99).toFixed(2),
                ),
                analysisAccuracy: Number((88 + overallQuality * 12).toFixed(1)),
                correlation: Number((0.72 + overallQuality * 0.27).toFixed(2)),
                reliability: Number((0.70 + overallQuality * 0.29).toFixed(2)),
                stability: Number(stabilityPct.toFixed(1)),
              });
            }}
          />
          <video ref={engineVideoRef} playsInline muted />
          <canvas ref={engineCanvasRef} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function TrainingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TrainingProvider>
      <TrainingLayoutContent>{children}</TrainingLayoutContent>
    </TrainingProvider>
  );
}
