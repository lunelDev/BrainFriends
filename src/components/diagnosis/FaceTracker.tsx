"use client";

import React, { useEffect, useRef } from "react";
import {
  FaceLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "@mediapipe/tasks-vision";
import { calculateLipMetrics, LipMetrics } from "@/utils/faceAnalysis";

const TFLITE_XNNPACK_INFO = "Created TensorFlow Lite XNNPACK delegate for CPU";
const LOCAL_MEDIAPIPE_WASM_PATH = "/mediapipe/wasm";
const LOCAL_FACE_LANDMARKER_MODEL_PATH =
  "/mediapipe/models/face_landmarker.task";

function hasNoisyTfliteMessage(value: unknown): boolean {
  if (typeof value === "string") return value.includes(TFLITE_XNNPACK_INFO);
  if (value instanceof Error) return value.message.includes(TFLITE_XNNPACK_INFO);
  return false;
}

// ✅ 타입을 확장해서 landmarks를 포함시킵니다.
interface ExtendedMetrics extends LipMetrics {
  landmarks: any[];
  faceDetected: boolean;
  processingMs: number;
  frameGapMs: number;
  fps: number;
}

type Props = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  maxFps?: number;
  onReady?: () => void;
  onMetricsUpdate: (metrics: ExtendedMetrics) => void; // ✅ 변경
};

export default function FaceTracker({
  videoRef,
  canvasRef,
  maxFps = 30,
  onReady,
  onMetricsUpdate,
}: Props) {
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);
  const lastUpdateRef = useRef(0);
  const lastDeliveredAtRef = useRef(0);
  const smoothedMetricsRef = useRef<ExtendedMetrics | null>(null);

  const tick = () => {
    const now = performance.now();
    const minInterval = 1000 / Math.max(1, maxFps);

    if (now - lastTickRef.current < minInterval) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    if (
      landmarkerRef.current &&
      videoRef.current &&
      videoRef.current.readyState >= 2
    ) {
      try {
        const detectStart = performance.now();
        const results = landmarkerRef.current.detectForVideo(
          videoRef.current,
          Math.round(now),
        );
        const detectEnd = performance.now();
        const processingMs = detectEnd - detectStart;
        const face = results.faceLandmarks?.[0];

        if (now - lastUpdateRef.current > 100) {
          const frameGapMs = lastDeliveredAtRef.current
            ? detectEnd - lastDeliveredAtRef.current
            : 0;
          const fps = frameGapMs > 0 ? 1000 / frameGapMs : 0;

          if (face) {
            const metrics = calculateLipMetrics(face);
            const nextMetrics: ExtendedMetrics = {
              ...metrics,
              landmarks: face,
              faceDetected: true,
              processingMs: Number(processingMs.toFixed(2)),
              frameGapMs: Number(frameGapMs.toFixed(2)),
              fps: Number(fps.toFixed(1)),
            };
            const previous = smoothedMetricsRef.current;
            const alpha = metrics.trackingQualityPct >= 70 ? 0.28 : 0.14;
            const smoothValue = (currentValue: number, previousValue?: number) =>
              Number(
                (
                  (previousValue ?? currentValue) * (1 - alpha) +
                  currentValue * alpha
                ).toFixed(2),
              );
            const smoothed: ExtendedMetrics = {
              ...nextMetrics,
              symmetryScore: smoothValue(
                nextMetrics.symmetryScore,
                previous?.symmetryScore,
              ),
              openingRatio: smoothValue(
                nextMetrics.openingRatio,
                previous?.openingRatio,
              ),
              mouthWidth: smoothValue(nextMetrics.mouthWidth, previous?.mouthWidth),
              deviation: smoothValue(nextMetrics.deviation, previous?.deviation),
              staticSymmetryScore: smoothValue(
                nextMetrics.staticSymmetryScore,
                previous?.staticSymmetryScore,
              ),
              dynamicSymmetryScore: smoothValue(
                nextMetrics.dynamicSymmetryScore,
                previous?.dynamicSymmetryScore,
              ),
              eyebrowLiftPct: smoothValue(
                nextMetrics.eyebrowLiftPct,
                previous?.eyebrowLiftPct,
              ),
              eyeClosureStrengthPct: smoothValue(
                nextMetrics.eyeClosureStrengthPct,
                previous?.eyeClosureStrengthPct,
              ),
              trackingQualityPct: smoothValue(
                nextMetrics.trackingQualityPct,
                previous?.trackingQualityPct,
              ),
              rollAngleDeg: smoothValue(
                nextMetrics.rollAngleDeg,
                previous?.rollAngleDeg,
              ),
            };
            smoothedMetricsRef.current = smoothed;
            onMetricsUpdate(smoothed);
          } else {
            smoothedMetricsRef.current = null;
            onMetricsUpdate({
              ...calculateLipMetrics([]),
              landmarks: [],
              faceDetected: false,
              processingMs: Number(processingMs.toFixed(2)),
              frameGapMs: Number(frameGapMs.toFixed(2)),
              fps: Number(fps.toFixed(1)),
            });
          }
          lastDeliveredAtRef.current = detectEnd;
          lastUpdateRef.current = now;
        }
        lastTickRef.current = now;
      } catch (err) {
        if (hasNoisyTfliteMessage(err)) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        console.warn("Analysis skip:", err);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    let cancelled = false;
    const originalConsoleError = console.error;

    console.error = (...args: unknown[]) => {
      if (args.some(hasNoisyTfliteMessage)) return;
      originalConsoleError(...args);
    };

    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          LOCAL_MEDIAPIPE_WASM_PATH,
        );
        if (cancelled) return;

        landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: LOCAL_FACE_LANDMARKER_MODEL_PATH,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
        });

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: false,
        });

        if (videoRef.current && !cancelled) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            onReady?.();
            tick();
          };
        }
      } catch (error) {
        onMetricsUpdate({
          ...calculateLipMetrics([]),
          landmarks: [],
          faceDetected: false,
          processingMs: 0,
          frameGapMs: 0,
          fps: 0,
        });
        console.warn("FaceTracker initialization skipped:", error);
      }
    };

    init();
    return () => {
      cancelled = true;
      console.error = originalConsoleError;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
      smoothedMetricsRef.current = null;
    };
  }, []);

  return null;
}
