"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTraining } from "../../app/(training)/TrainingContext";

type GuideSeverity = "idle" | "normal" | "caution" | "warning";

type FaceGuideData = {
  eyeCenter: { x: number; y: number };
  nose: { x: number; y: number };
  mouthCenter: { x: number; y: number };
  chin: { x: number; y: number };
  leftCheek: { x: number; y: number };
  rightCheek: { x: number; y: number };
  leftMouth: { x: number; y: number };
  rightMouth: { x: number; y: number };
  leftJaw: { x: number; y: number };
  rightJaw: { x: number; y: number };
  faceWidth: number;
  signedDeviationPct: number;
  deviationPct: number;
  mouthTiltPct: number;
  jawTiltPct: number;
};

function getFaceGuideData(landmarks: any[]): FaceGuideData | null {
  const leftCheek = landmarks?.[234];
  const rightCheek = landmarks?.[454];
  const leftEye = landmarks?.[105];
  const rightEye = landmarks?.[334];
  const nose = landmarks?.[1];
  const leftMouth = landmarks?.[61];
  const rightMouth = landmarks?.[291];
  const chin = landmarks?.[152];
  const leftJaw = landmarks?.[136] || landmarks?.[172];
  const rightJaw = landmarks?.[365] || landmarks?.[397];
  const upperLip = landmarks?.[13];
  const lowerLip = landmarks?.[14];

  if (
    !leftCheek ||
    !rightCheek ||
    !leftEye ||
    !rightEye ||
    !nose ||
    !leftMouth ||
    !rightMouth ||
    !chin ||
    !leftJaw ||
    !rightJaw ||
    !upperLip ||
    !lowerLip
  ) {
    return null;
  }

  const eyeCenter = {
    x: (leftEye.x + rightEye.x) / 2,
    y: (leftEye.y + rightEye.y) / 2,
  };
  const mouthCenter = {
    x: (leftMouth.x + rightMouth.x + upperLip.x + lowerLip.x) / 4,
    y: (leftMouth.y + rightMouth.y + upperLip.y + lowerLip.y) / 4,
  };
  const faceWidth = Math.max(0.001, Math.abs(rightCheek.x - leftCheek.x));

  const dx = chin.x - eyeCenter.x;
  const dy = chin.y - eyeCenter.y;
  const norm = Math.hypot(dx, dy) || 1;
  const signedDist =
    ((mouthCenter.x - eyeCenter.x) * dy - (mouthCenter.y - eyeCenter.y) * dx) /
    norm;
  const signedDeviationPct = (signedDist / faceWidth) * 100;
  const deviationPct = Math.abs(signedDeviationPct);
  const mouthTiltPct = (Math.abs(rightMouth.y - leftMouth.y) / faceWidth) * 100;
  const jawTiltPct = (Math.abs(rightJaw.y - leftJaw.y) / faceWidth) * 100;

  return {
    eyeCenter,
    nose: { x: nose.x, y: nose.y },
    mouthCenter,
    chin: { x: chin.x, y: chin.y },
    leftCheek: { x: leftCheek.x, y: leftCheek.y },
    rightCheek: { x: rightCheek.x, y: rightCheek.y },
    leftMouth: { x: leftMouth.x, y: leftMouth.y },
    rightMouth: { x: rightMouth.x, y: rightMouth.y },
    leftJaw: { x: leftJaw.x, y: leftJaw.y },
    rightJaw: { x: rightJaw.x, y: rightJaw.y },
    faceWidth,
    signedDeviationPct,
    deviationPct,
    mouthTiltPct,
    jawTiltPct,
  };
}

export const AnalysisSidebar = ({
  videoRef,
  canvasRef,
  isFaceReady,
  metrics,
  showTracking,
  onToggleTracking,
}: any) => {
  const { sidebarMetrics } = useTraining(); // 전역 좌표 데이터를 가져옴
  const [localShowTracking, setLocalShowTracking] = useState(
    Boolean(showTracking),
  );
  const [showDetails, setShowDetails] = useState(false);
  const [overlayMode, setOverlayMode] = useState<"face" | "lips">("face");
  const landmarksRef = useRef<any[]>([]);
  const emaRef = useRef({
    ready: false,
    signedDeviationPct: 0,
    deviationPct: 0,
    mouthTiltPct: 0,
    jawTiltPct: 0,
  });
  const warningSinceRef = useRef<number | null>(null);
  const [asymmetryVisual, setAsymmetryVisual] = useState<{
    label: string;
    detail: string;
    state: GuideSeverity;
    signedDeviationPct: number;
    deviationPct: number;
    mouthTiltPct: number;
    jawTiltPct: number;
  }>({
    label: "안면 비대칭 분석 중",
    detail: "",
    state: "idle",
    signedDeviationPct: 0,
    deviationPct: 0,
    mouthTiltPct: 0,
    jawTiltPct: 0,
  });

  const isControlled = useMemo(
    () =>
      typeof showTracking === "boolean" &&
      typeof onToggleTracking === "function",
    [showTracking, onToggleTracking],
  );

  const trackingEnabled = isControlled
    ? Boolean(showTracking)
    : localShowTracking;

  const normalizePct = (value: number) => {
    const safe = Number(value || 0);
    return safe <= 1 ? safe * 100 : safe;
  };
  const staticSymmetry = normalizePct(
    Number(
      (metrics?.staticSymmetryScore ??
        sidebarMetrics?.staticFacialSymmetry ??
        0) ||
        0,
    ),
  );
  const dynamicSymmetry = normalizePct(
    Number(
      (metrics?.dynamicSymmetryScore ??
        sidebarMetrics?.dynamicFacialSymmetry ??
        0) ||
        0,
    ),
  );
  const eyebrowLift = normalizePct(
    Number((metrics?.eyebrowLift ?? sidebarMetrics?.eyebrowLift ?? 0) || 0),
  );
  const eyeClosureStrength = normalizePct(
    Number(
      (metrics?.eyeClosureStrength ??
        sidebarMetrics?.eyeClosureStrength ??
        0) ||
        0,
    ),
  );
  const lipGuide = getLipGuideFeedback({
    mouthOpening: Number(metrics?.openingRatio || 0),
    consonantAcc: Number(metrics?.consonantAcc || 0),
    vowelAcc: Number(metrics?.vowelAcc || 0),
  });

  useEffect(() => {
    if (typeof showTracking === "boolean") {
      setLocalShowTracking(showTracking);
    }
  }, [showTracking]);

  useEffect(() => {
    landmarksRef.current = sidebarMetrics?.landmarks || [];
  }, [sidebarMetrics?.landmarks]);

  const handleToggleTracking = () => {
    if (typeof onToggleTracking === "function") {
      onToggleTracking();
      return;
    }
    setLocalShowTracking((prev) => !prev);
  };

  useEffect(() => {
    const landmarks = sidebarMetrics?.landmarks;
    const guide = getFaceGuideData(landmarks || []);
    if (!guide) {
      warningSinceRef.current = null;
      emaRef.current.ready = false;
      setAsymmetryVisual((prev) => ({
        ...prev,
        label: "안면 비대칭 분석 중",
        detail: "",
        state: "idle",
      }));
      return;
    }

    const alpha = 0.22;
    if (!emaRef.current.ready) {
      emaRef.current = {
        ready: true,
        signedDeviationPct: guide.signedDeviationPct,
        deviationPct: guide.deviationPct,
        mouthTiltPct: guide.mouthTiltPct,
        jawTiltPct: guide.jawTiltPct,
      };
    } else {
      emaRef.current.signedDeviationPct =
        emaRef.current.signedDeviationPct * (1 - alpha) +
        guide.signedDeviationPct * alpha;
      emaRef.current.deviationPct =
        emaRef.current.deviationPct * (1 - alpha) + guide.deviationPct * alpha;
      emaRef.current.mouthTiltPct =
        emaRef.current.mouthTiltPct * (1 - alpha) + guide.mouthTiltPct * alpha;
      emaRef.current.jawTiltPct =
        emaRef.current.jawTiltPct * (1 - alpha) + guide.jawTiltPct * alpha;
    }

    const dev = emaRef.current.deviationPct;
    const mouthTilt = emaRef.current.mouthTiltPct;
    const jawTilt = emaRef.current.jawTiltPct;
    const signedDev = emaRef.current.signedDeviationPct;
    const side = signedDev > 0 ? "우측" : "좌측";

    const warningCandidate = dev >= 2.5 || mouthTilt >= 1.6 || jawTilt >= 1.6;
    let state: GuideSeverity = "normal";
    if (warningCandidate) {
      if (!warningSinceRef.current) warningSinceRef.current = performance.now();
      state =
        performance.now() - warningSinceRef.current >= 300
          ? "warning"
          : "caution";
    } else {
      warningSinceRef.current = null;
      state =
        dev >= 1.5 || mouthTilt >= 1.0 || jawTilt >= 1.0 ? "caution" : "normal";
    }

    const label =
      state === "warning"
        ? `${side} 비대칭 경고`
        : state === "caution"
          ? "주의 관찰"
          : "정상 범위";

    setAsymmetryVisual({
      label,
      detail: `편위 ${dev.toFixed(1)}% · 입 ${mouthTilt.toFixed(1)}% · 턱 ${jawTilt.toFixed(1)}%`,
      state,
      signedDeviationPct: signedDev,
      deviationPct: dev,
      mouthTiltPct: mouthTilt,
      jawTiltPct: jawTilt,
    });
  }, [sidebarMetrics?.landmarks]);

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startCamera() {
      try {
        if (
          navigator.mediaDevices &&
          navigator.mediaDevices.getUserMedia &&
          videoRef.current
        ) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 },
            audio: false,
          });

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play().catch(console.error);
            };
          }
        }
      } catch (err) {
        console.error("사이드바 카메라 스트림 연결 실패:", err);
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [videoRef]);

  useEffect(() => {
    if (!canvasRef || !canvasRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas || !trackingEnabled) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId: number;

    const drawLipOutline = () => {
      const landmarks = landmarksRef.current;
      if (!landmarks || landmarks.length === 0) return;

      const toPoint = (idx: number) => ({
        x: landmarks[idx].x * canvas.width,
        y: landmarks[idx].y * canvas.height,
      });

      const upperOuter = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291];
      const lowerOuter = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291];
      const upperInner = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
      const lowerInner = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308];

      const hasAllUpperOuter = upperOuter.every((idx) => landmarks[idx]);
      const hasAllLowerOuter = lowerOuter.every((idx) => landmarks[idx]);
      const hasAllUpperInner = upperInner.every((idx) => landmarks[idx]);
      const hasAllLowerInner = lowerInner.every((idx) => landmarks[idx]);

      const palette = {
        line: lipGuide.overlayLine,
        axis: lipGuide.overlayAxis,
      };

      ctx.strokeStyle = palette.axis;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);

      if (hasAllUpperOuter) {
        ctx.beginPath();
        upperOuter.forEach((idx, i) => {
          const p = toPoint(idx);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
      }

      if (hasAllLowerOuter) {
        ctx.beginPath();
        lowerOuter.forEach((idx, i) => {
          const p = toPoint(idx);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
      }

      if (hasAllUpperInner) {
        ctx.strokeStyle = palette.line;
        ctx.setLineDash([2, 2]);
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        upperInner.forEach((idx, i) => {
          const p = toPoint(idx);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
      }

      if (hasAllLowerInner) {
        ctx.strokeStyle = palette.line;
        ctx.setLineDash([2, 2]);
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        lowerInner.forEach((idx, i) => {
          const p = toPoint(idx);
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
      }

      ctx.setLineDash([]);
    };

    const drawFaceGuides = () => {
      const landmarks = landmarksRef.current;
      if (!landmarks || landmarks.length === 0) return;

      const guide = getFaceGuideData(landmarks);
      if (!guide) return;

      const toPoint = (p: { x: number; y: number }) => ({
        x: p.x * canvas.width,
        y: p.y * canvas.height,
      });

      const lCheek = toPoint(guide.leftCheek);
      const rCheek = toPoint(guide.rightCheek);
      const eye = toPoint(guide.eyeCenter);
      const nose = toPoint(guide.nose);
      const chin = toPoint(guide.chin);
      const faceWidthPx = Math.max(1, Math.abs(rCheek.x - lCheek.x));
      const axisDx = chin.x - eye.x;
      const axisDy = chin.y - eye.y;
      const axisNorm = Math.hypot(axisDx, axisDy) || 1;
      const ux = axisDx / axisNorm;
      const uy = axisDy / axisNorm;
      // 세로축(얼굴 중심축)에 수직인 단위벡터
      const px = -uy;
      const py = ux;

      const palette =
        asymmetryVisual.state === "warning"
          ? {
              line: "rgba(248, 113, 113, 0.98)",
              axis: "rgba(239, 68, 68, 0.98)",
            }
          : asymmetryVisual.state === "caution"
            ? {
                line: "rgba(251, 191, 36, 0.95)",
                axis: "rgba(245, 158, 11, 0.98)",
              }
            : {
                line: "rgba(167, 243, 208, 0.95)",
                axis: "rgba(16, 185, 129, 0.95)",
              };

      // 얼굴 중심 세로선 1개
      ctx.strokeStyle = palette.axis;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(eye.x - ux * 14, eye.y - uy * 14);
      ctx.lineTo(chin.x + ux * 8, chin.y + uy * 8);
      ctx.stroke();

      // 얼굴 중심 가로선 1개 (코 중심)
      ctx.strokeStyle = palette.line;
      ctx.lineWidth = 0.7;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      const halfSpan = Math.max(10, faceWidthPx * 0.44);
      ctx.moveTo(nose.x - px * halfSpan, nose.y - py * halfSpan);
      ctx.lineTo(nose.x + px * halfSpan, nose.y + py * halfSpan);
      ctx.stroke();
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (overlayMode === "lips") drawLipOutline();
      else drawFaceGuides();
      rafId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafId);
  }, [
    trackingEnabled,
    canvasRef,
    overlayMode,
    asymmetryVisual.state,
    asymmetryVisual.signedDeviationPct,
    metrics?.consonantAcc,
    metrics?.vowelAcc,
  ]);

  return (
    <div className="w-full flex flex-col gap-3 lg:h-full overflow-visible lg:overflow-hidden">
      {/* 카메라 프리뷰 섹션 */}
      <div className="relative aspect-[4/3] bg-gray-900 rounded-[24px] overflow-hidden shrink-0 shadow-inner">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover -scale-x-100"
        />
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full -scale-x-100 transition-opacity duration-300 ${
            trackingEnabled ? "opacity-100" : "opacity-0"
          }`}
        />

        {!isFaceReady && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-[10px] font-black tracking-widest z-[5]">
            AI INITIALIZING...
          </div>
        )}

        <div className="absolute top-3 right-3 z-10">
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={handleToggleTracking}
              className={`w-9 h-9 flex items-center justify-center rounded-xl backdrop-blur-md transition-all ${
                trackingEnabled
                  ? "bg-orange-500 text-white"
                  : "bg-black/40 text-gray-400"
              }`}
            >
              {trackingEnabled ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9.88 9.88L12 12m.12 4.12l1.1 1.1M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zM21.25 18L3 3m15 15l-3-3m-6.12-6.12L8 8" />
                </svg>
              )}
            </button>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setOverlayMode("face")}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-tight backdrop-blur-md border transition-all ${
                  overlayMode === "face"
                    ? "bg-white text-slate-900 border-white/80"
                    : "bg-black/40 text-gray-300 border-white/10"
                }`}
              >
                안면
              </button>
              <button
                onClick={() => setOverlayMode("lips")}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-tight backdrop-blur-md border transition-all ${
                  overlayMode === "lips"
                    ? "bg-white text-slate-900 border-white/80"
                    : "bg-black/40 text-gray-300 border-white/10"
                }`}
              >
                입술
              </button>
            </div>
          </div>
        </div>

        <div className="absolute top-3 left-3 z-10">
          <div
            className={`px-2.5 py-1 rounded-lg text-[10px] font-black border backdrop-blur-sm ${
              asymmetryVisual.state === "normal"
                ? "bg-emerald-500/85 border-emerald-300 text-white"
                : asymmetryVisual.state === "caution"
                  ? "bg-amber-500/90 border-amber-200 text-slate-900"
                  : asymmetryVisual.state === "warning"
                    ? "bg-red-500/90 border-red-200 text-white"
                    : "bg-black/40 border-white/30 text-white"
            }`}
          >
            {asymmetryVisual.label}
            {asymmetryVisual.detail ? ` · ${asymmetryVisual.detail}` : ""}
          </div>
        </div>
        {overlayMode === "lips" && trackingEnabled ? (
          <div className="absolute bottom-3 left-3 right-3 z-10">
            <div
              className="px-3 py-1.5 rounded-lg text-[10px] font-black border backdrop-blur-sm"
              style={{
                color: "#111827",
                borderColor: lipGuide.badgeBorder,
                backgroundColor: lipGuide.badgeBg,
              }}
            >
              {lipGuide.label}
            </div>
          </div>
        ) : null}
      </div>

      <div className="lg:hidden rounded-[14px] border border-gray-100 bg-[#FBFBFC] px-3 py-3">
        <div className="grid grid-cols-2 gap-2 text-[11px] font-black text-slate-500">
          <div className="rounded-lg border border-slate-100 bg-white px-2 py-1.5">
            안면대칭성{" "}
            <b className="text-emerald-600">
              {Number(metrics.symmetryScore || 0).toFixed(1)}%
            </b>
          </div>
          <div className="rounded-lg border border-slate-100 bg-white px-2 py-1.5">
            자음{" "}
            <b className="text-emerald-600">
              {Number(metrics.consonantAcc || 0).toFixed(1)}%
            </b>
          </div>
          <div className="rounded-lg border border-slate-100 bg-white px-2 py-1.5">
            모음{" "}
            <b className="text-orange-500">
              {Number(metrics.vowelAcc || 0).toFixed(1)}%
            </b>
          </div>
          <div className="rounded-lg border border-slate-100 bg-white px-2 py-1.5 col-span-2">
            음성{" "}
            <b className="text-orange-500">
              {Math.round(Number(metrics.audioLevel || 0))}dB
            </b>
          </div>
        </div>
      </div>

      <div className="lg:hidden rounded-[14px] border border-gray-100 bg-[#FBFBFC] px-3 py-3 space-y-3">
        <button
          type="button"
          onClick={() => setShowDetails((prev) => !prev)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-700"
        >
          {showDetails ? "세부 지표 숨기기" : "세부 지표 보기"}
        </button>
        {showDetails ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-100 bg-white p-3 space-y-2">
              <ConsonantDetailSection
                containerClassName="space-y-2"
                metrics={metrics}
              />
            </div>
            <div className="rounded-xl border border-slate-100 bg-white p-3 space-y-2">
              <VowelDetailSection
                containerClassName="space-y-2"
                metrics={metrics}
              />
            </div>
            <div className="rounded-xl border border-slate-100 bg-white p-3 space-y-2 sm:col-span-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <UpperFaceSection
                  containerClassName="space-y-2 sm:col-span-2"
                  staticSymmetry={staticSymmetry}
                  dynamicSymmetry={dynamicSymmetry}
                  eyebrowLift={eyebrowLift}
                  eyeClosureStrength={eyeClosureStrength}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="hidden lg:block flex-1 bg-[#FBFBFC] rounded-[24px] p-5 space-y-4 border border-gray-50 shadow-sm overflow-y-auto min-h-0">
        <MetricBar
          label="안면 대칭성"
          value={metrics.symmetryScore}
          color="bg-emerald-400"
        />

        <div className="pt-3 border-t border-gray-100 space-y-4">
          <MetricBar
            label="자음 정확도"
            value={metrics.consonantAcc}
            color="bg-blue-500"
          />
          <MetricBar
            label="모음 정확도"
            value={metrics.vowelAcc}
            color="bg-purple-500"
          />
        </div>

        <div className="pt-3 border-t border-gray-100 space-y-3">
          <button
            type="button"
            onClick={() => setShowDetails((prev) => !prev)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-700"
          >
            {showDetails ? "세부 지표 숨기기" : "세부 지표 보기"}
          </button>
          {showDetails ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ConsonantDetailSection metrics={metrics} />
              <VowelDetailSection metrics={metrics} />
            </div>
          ) : null}
        </div>

        <div className="pt-3 border-t border-gray-100 space-y-3">
          <UpperFaceSection
            containerClassName="space-y-3"
            staticSymmetry={staticSymmetry}
            dynamicSymmetry={dynamicSymmetry}
            eyebrowLift={eyebrowLift}
            eyeClosureStrength={eyeClosureStrength}
          />
        </div>

        <div className="pt-3 border-t border-gray-100">
          <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase mb-2 tracking-tighter">
            <span>Audio Level</span>
            <span className="text-orange-500 font-mono">
              {Math.round(metrics.audioLevel)} dB
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-400 transition-all duration-75"
              style={{ width: `${Math.min(100, metrics.audioLevel)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricBar = ({ label, value, color, meta, valueLabel }: any) => (
  <div className="space-y-1">
    <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-tighter">
      <span>{label}</span>
      <div className="text-right leading-none">
        <span className="text-gray-600 font-mono">
          {valueLabel || `${Number(value || 0).toFixed(1)}%`}
        </span>
        {meta ? (
          <div className="text-[9px] text-slate-400 font-mono mt-0.5">
            {meta}
          </div>
        ) : null}
      </div>
    </div>
    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`h-full ${color} transition-all duration-300`}
        style={{ width: `${Math.min(Number(value || 0), 100)}%` }}
      />
    </div>
  </div>
);

const ConsonantDetailSection = ({
  containerClassName = "space-y-3",
  metrics,
}: any) => (
  <div className={containerClassName}>
    <div className="text-[10px] font-black text-slate-500 uppercase tracking-tight">
      자음 세부 지표
    </div>
    <MetricBar
      label="폐쇄율"
      value={metrics.consonantClosureRate}
      color={pickGaugeColorForRange(
        "closureRate",
        metrics.consonantClosureRate,
      )}
    />
    <MetricBar
      label="폐쇄 유지시간(ms)"
      value={metrics.consonantClosureHold}
      color={pickGaugeColorForRange(
        "closureHoldMs",
        metrics.consonantClosureHoldMs,
      )}
      valueLabel={`${Number(metrics.consonantClosureHoldMs || 0).toFixed(0)}ms`}
    />
    <MetricBar
      label="좌우 대칭(%)"
      value={metrics.consonantLipSymmetry}
      color={pickGaugeColor(metrics.consonantLipSymmetry)}
    />
    <MetricBar
      label="개방 속도(ms)"
      value={metrics.consonantOpeningSpeed}
      color={pickGaugeColorForRange(
        "openingSpeedMs",
        metrics.consonantOpeningSpeedMs,
      )}
      valueLabel={`${Number(metrics.consonantOpeningSpeedMs || 0).toFixed(0)}ms`}
    />
  </div>
);

const VowelDetailSection = ({
  containerClassName = "space-y-3",
  metrics,
}: any) => (
  <div className={containerClassName}>
    <div className="text-[10px] font-black text-slate-500 uppercase tracking-tight">
      모음 세부 지표
    </div>
    <MetricBar
      label="입벌림(%)"
      value={metrics.vowelMouthOpening}
      color={pickGaugeColor(metrics.vowelMouthOpening)}
    />
    <MetricBar
      label="입술 너비(%)"
      value={metrics.vowelMouthWidth}
      color={pickGaugeColor(metrics.vowelMouthWidth)}
    />
    <MetricBar
      label="둥글림"
      value={metrics.vowelRounding}
      color={pickGaugeColor(metrics.vowelRounding)}
    />
    <MetricBar
      label="패턴 일치도"
      value={metrics.vowelPatternMatch}
      color={pickGaugeColor(metrics.vowelPatternMatch)}
    />
  </div>
);

const UpperFaceSection = ({
  containerClassName = "space-y-3",
  staticSymmetry,
  dynamicSymmetry,
  eyebrowLift,
  eyeClosureStrength,
}: any) => (
  <div className={containerClassName}>
    <div className="text-[10px] font-black text-slate-500 uppercase tracking-tight">
      상안면 지표
    </div>
    <MetricBar
      label="정적 대칭(%)"
      value={staticSymmetry}
      color={pickGaugeColor(staticSymmetry)}
    />
    <MetricBar
      label="동적 대칭(%)"
      value={dynamicSymmetry}
      color={pickGaugeColor(dynamicSymmetry)}
    />
    <MetricBar
      label="눈썹 거상(%)"
      value={eyebrowLift}
      color={pickGaugeColor(eyebrowLift)}
    />
    <MetricBar
      label="안검 폐쇄력(%)"
      value={eyeClosureStrength}
      color={pickGaugeColor(eyeClosureStrength)}
    />
  </div>
);

function pickGaugeColor(value: number) {
  const safe = Number(value || 0);
  if (safe < 60) return "bg-red-500";
  if (safe < 75) return "bg-amber-500";
  return "bg-emerald-500";
}

function pickGaugeColorForRange(
  metric: "closureRate" | "closureHoldMs" | "openingSpeedMs",
  rawValue: number,
) {
  const safe = Number(rawValue || 0);

  if (metric === "closureRate") {
    if (safe < 10) return "bg-red-500";
    if (safe < 25) return "bg-amber-500";
    if (safe <= 65) return "bg-emerald-500";
    if (safe <= 85) return "bg-amber-500";
    return "bg-red-500";
  }

  if (metric === "closureHoldMs") {
    if (safe < 60) return "bg-red-500";
    if (safe < 120) return "bg-amber-500";
    if (safe <= 320) return "bg-emerald-500";
    if (safe <= 500) return "bg-amber-500";
    return "bg-red-500";
  }

  // openingSpeedMs: 적정 반응 구간 중심(너무 느리거나 너무 빠르면 경고)
  if (safe < 180) return "bg-red-500";
  if (safe < 260) return "bg-amber-500";
  if (safe <= 520) return "bg-emerald-500";
  if (safe <= 700) return "bg-amber-500";
  return "bg-red-500";
}

function lerpColor(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
) {
  const p = Math.max(0, Math.min(1, t));
  const r = Math.round(a[0] + (b[0] - a[0]) * p);
  const g = Math.round(a[1] + (b[1] - a[1]) * p);
  const bCh = Math.round(a[2] + (b[2] - a[2]) * p);
  return `rgba(${r}, ${g}, ${bCh}, 0.96)`;
}

function getLipGuideFeedback({
  mouthOpening,
  consonantAcc,
  vowelAcc,
}: {
  mouthOpening: number;
  consonantAcc: number;
  vowelAcc: number;
}) {
  const open = Math.max(0, Math.min(100, Number(mouthOpening || 0)));
  const articulation = Math.max(
    0,
    Math.min(100, (Number(consonantAcc || 0) + Number(vowelAcc || 0)) / 2),
  );
  const t = Math.max(0, Math.min(1, open / 80));
  const line = lerpColor([74, 222, 128], [249, 115, 22], t);
  const axis = lerpColor([34, 197, 94], [234, 88, 12], t);

  const label =
    articulation < 55
      ? "입술 폐쇄/개방 정확도를 다시 맞춰보세요."
      : open < 28
        ? "좋아요! 조금 더 크게 벌려보세요."
        : open < 55
          ? "좋습니다. 현재 가동 범위를 유지하세요."
          : "매우 좋습니다! 충분히 크게 발화 중입니다.";

  return {
    label,
    overlayLine: line,
    overlayAxis: axis,
    badgeBg: lerpColor([187, 247, 208], [255, 237, 213], t).replace(
      "0.96",
      "0.9",
    ),
    badgeBorder: lerpColor([34, 197, 94], [234, 88, 12], t).replace(
      "0.96",
      "0.88",
    ),
  };
}
