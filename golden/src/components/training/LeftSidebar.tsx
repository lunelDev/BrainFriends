"use client";

import React, { useEffect, useRef } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { calculateLipMetrics, LipMetrics } from "@/utils/faceAnalysis";

type Props = {
  videoRef?: React.RefObject<HTMLVideoElement>;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
  maxFps?: number;

  onReady?: () => void;
  onFaceDetected?: (detected: boolean) => void;
  onFrameLatency?: (ms: number) => void;
  onMetricsUpdate?: (metrics: LipMetrics) => void;
};

export default function FaceTracker({
  videoRef,
  canvasRef,
  maxFps = 30,
  onReady,
  onFaceDetected,
  onFrameLatency,
  onMetricsUpdate,
}: Props) {
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const lastTickRef = useRef<number>(0);
  const lastFaceDetectedRef = useRef<boolean>(false);

  // 내부 fallback video (부모가 videoRef를 넘겨주지 않을 때만 사용)
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const getVideoEl = () => videoRef?.current ?? internalVideoRef.current;

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // 1) mediapipe init
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
        );

        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
        });

        if (cancelled) return;
        landmarkerRef.current = landmarker;

        // 2) camera init
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        const video = getVideoEl();
        if (!video) return;

        video.srcObject = stream;
        video.playsInline = true;
        video.muted = true;
        video.autoplay = true;

        // iOS Safari 대응 play() 호출
        const tryPlay = async () => {
          try {
            await video.play();
          } catch {
            // 사용자 제스처가 필요할 수 있음 (페이지 내 버튼 클릭 시 정상)
          }
        };

        video.onloadedmetadata = () => {
          if (cancelled) return;
          // canvas size sync
          syncCanvasToVideo();
          onReady?.();
          tryPlay();
          tick(); // start loop
        };
      } catch (e) {
        console.error("FaceTracker init error:", e);
      }
    }

    init();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      // landmarker destroy API는 버전마다 다를 수 있어 참조만 해제
      landmarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncCanvasToVideo = () => {
    const video = getVideoEl();
    const canvas = canvasRef?.current;
    if (!video || !canvas) return;

    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;

    // 캔버스는 CSS로 크기 조절, 실제 해상도는 video 비율에 맞춤
    canvas.width = vw;
    canvas.height = vh;
  };

  const drawOverlay = (landmarks: any[]) => {
    const canvas = canvasRef?.current;
    const video = getVideoEl();
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // clear
    ctx.clearRect(0, 0, w, h);

    const toPoint = (idx: number) => ({
      x: landmarks[idx].x * w,
      y: landmarks[idx].y * h,
    });

    const drawLipOutline = () => {
      const outer = [
        61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402,
        317, 14, 87, 178, 88, 95, 78,
      ];
      const inner = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308];

      const hasAllOuter = outer.every((idx) => landmarks[idx]);
      const hasAllInner = inner.every((idx) => landmarks[idx]);

      ctx.strokeStyle = "rgba(120, 255, 150, 0.95)";
      ctx.lineWidth = 1.25;
      ctx.setLineDash([]);

      if (hasAllOuter) {
        ctx.beginPath();
        outer.forEach((idx, i) => {
          const p = toPoint(idx);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.stroke();
      }

      if (hasAllInner) {
        ctx.beginPath();
        inner.forEach((idx, i) => {
          const p = toPoint(idx);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.stroke();
      }
    };
    // 안면 비대칭 가이드: 세로 실선 1개 + 가로 점선 3개 (얼굴 각도 추종)
    const leftCheek = landmarks[234];
    const rightCheek = landmarks[454];
    const leftBrow = landmarks[105];
    const rightBrow = landmarks[334];
    const noseTip = landmarks[1];
    const leftMouth = landmarks[61];
    const rightMouth = landmarks[291];
    const chin = landmarks[152];
    const leftJaw = landmarks[136] || landmarks[172];
    const rightJaw = landmarks[365] || landmarks[397];

    if (
      leftCheek &&
      rightCheek &&
      leftBrow &&
      rightBrow &&
      noseTip &&
      leftMouth &&
      rightMouth &&
      chin &&
      leftJaw &&
      rightJaw
    ) {
      const lCheek = toPoint(234);
      const rCheek = toPoint(454);
      const lEye = toPoint(105);
      const rEye = toPoint(334);
      const n = toPoint(1);
      const lM = toPoint(61);
      const rM = toPoint(291);
      const c = toPoint(152);
      let lJ = { x: leftJaw.x * w, y: leftJaw.y * h };
      let rJ = { x: rightJaw.x * w, y: rightJaw.y * h };

      const eyeCenter = { x: (lEye.x + rEye.x) / 2, y: (lEye.y + rEye.y) / 2 };
      const mouthCenter = { x: (lM.x + rM.x) / 2, y: (lM.y + rM.y) / 2 };
      const midX = (lCheek.x + rCheek.x) / 2;
      const eyeY = eyeCenter.y;
      const noseY = n.y;
      const mouthY = mouthCenter.y;
      const jawMinY = mouthY + (c.y - mouthY) * 0.72;

      // 턱선이 입선보다 올라오지 않도록 높이 보정
      if (lJ.y < jawMinY) lJ = { ...lJ, y: jawMinY };
      if (rJ.y < jawMinY) rJ = { ...rJ, y: jawMinY };

      const pad = 6;
      const startX = lCheek.x + pad;
      const endX = rCheek.x - pad;

      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 0.65;

      // 세로 실선(정중선)
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(midX, eyeY - 14);
      ctx.lineTo(midX, c.y + 8);
      ctx.stroke();

      // 가로 점선 3개
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      // 눈선
      ctx.moveTo(startX, eyeY);
      ctx.lineTo(endX, eyeY);
      // 코선
      ctx.moveTo(startX, noseY);
      ctx.lineTo(endX, noseY);
      // 입선
      ctx.moveTo(startX, mouthY);
      ctx.lineTo(endX, mouthY);
      ctx.stroke();

      // 턱라인 기준선
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(lJ.x, lJ.y);
      ctx.lineTo(rJ.x, rJ.y);
      ctx.stroke();
    }

    drawLipOutline();
  };

  const tick = () => {
    const t0 = performance.now();

    // FPS throttle
    const minInterval = 1000 / Math.max(1, maxFps);
    if (t0 - lastTickRef.current < minInterval) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    lastTickRef.current = t0;

    const landmarker = landmarkerRef.current;
    const video = getVideoEl();

    if (landmarker && video && video.readyState >= 2) {
      try {
        const results = landmarker.detectForVideo(video, t0);

        const face = results.faceLandmarks?.[0];
        const detected = !!face;

        if (detected !== lastFaceDetectedRef.current) {
          lastFaceDetectedRef.current = detected;
          onFaceDetected?.(detected);
        }

        if (detected && face) {
          // metrics
          const m = calculateLipMetrics(face);
          onMetricsUpdate?.(m);

          // overlay
          drawOverlay(face);
        } else {
          // no face → overlay clear
          const canvas = canvasRef?.current;
          const ctx = canvas?.getContext("2d");
          if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      } catch (e) {
        // detect 오류는 종종 발생 가능(권한/성능). 조용히 루프 지속
      }
    }

    const t1 = performance.now();
    onFrameLatency?.(t1 - t0);

    rafRef.current = requestAnimationFrame(tick);
  };

  // FaceTracker는 UI가 목적이 아님. 부모가 videoRef를 주면 내부 hidden video 사용
  return (
    <video
      ref={internalVideoRef}
      className="fixed top-0 left-0 w-0 h-0 opacity-0 pointer-events-none"
      autoPlay
      playsInline
      muted
    />
  );
}
