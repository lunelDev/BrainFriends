"use client";

import React from "react";
import { useTraining } from "@/app/(training)/TrainingContext";

export function RuntimeStatusBanner() {
  const { runtimeStatus, sidebarMetrics } = useTraining();

  const trackingQualityPct = Number(sidebarMetrics.trackingQuality || 0) * 100;
  const landmarkCount = Array.isArray(sidebarMetrics.landmarks)
    ? sidebarMetrics.landmarks.length
    : 0;

  const bannerState = runtimeStatus.pageError || runtimeStatus.needsRetry
    ? {
        title: "오류 감지",
        message: runtimeStatus.message || "오류가 발생했습니다.",
        retry: runtimeStatus.needsRetry,
        wrap: "border-red-200 bg-red-50 text-red-900",
        dot: "bg-red-500",
      }
    : runtimeStatus.saving
      ? {
          title: "저장 중",
          message: runtimeStatus.message || "결과를 저장하고 있습니다.",
          retry: false,
          wrap: "border-amber-200 bg-amber-50 text-amber-900",
          dot: "bg-amber-500",
        }
      : runtimeStatus.message
        ? {
            title: "안내",
            message: runtimeStatus.message,
            retry: false,
            wrap: "border-sky-200 bg-sky-50 text-sky-900",
            dot: "bg-sky-500",
          }
        : !sidebarMetrics.cameraActive || landmarkCount === 0 || trackingQualityPct < 15
          ? {
              title: "카메라 초기화 중",
              message: "카메라 권한과 장치 연결 상태를 확인해 주세요.",
              retry: false,
              wrap: "border-sky-200 bg-sky-50 text-sky-900",
              dot: "bg-sky-500",
            }
          : !sidebarMetrics.faceDetected || trackingQualityPct < 55
            ? {
                title: "측정 위치 조정 필요",
                message: "얼굴을 화면 중앙에 맞추고 조명과 카메라 각도를 조정해 주세요.",
                retry: false,
                wrap: "border-orange-200 bg-orange-50 text-orange-900",
                dot: "bg-orange-500",
              }
            : null;

  if (!bannerState) return null;

  return (
    <div
      className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 shadow-sm sm:items-center sm:px-5 ${bannerState.wrap}`}
    >
      <span
        className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full sm:mt-0 ${bannerState.dot} ${runtimeStatus.saving ? "animate-pulse" : ""}`}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-black leading-none">{bannerState.title}</p>
        <p className="mt-1 text-[12px] font-medium leading-snug sm:text-[13px]">
          {bannerState.message}
        </p>
      </div>
      {bannerState.retry ? (
        <span className="shrink-0 rounded-full bg-white/80 px-2 py-1 text-[11px] font-black text-red-700">
          재시도 필요
        </span>
      ) : null}
    </div>
  );
}
