"use client";

import React, { useState } from "react";
import { useTraining } from "@/app/(training)/TrainingContext";

export function DeveloperKpiPanel() {
  const { clinicalMetrics, runtimeStatus } = useTraining();
  const [open, setOpen] = useState(false);

  if (process.env.NODE_ENV !== "development") return null;

  return (
    <div className="fixed bottom-4 right-4 z-[140] no-print">
      <div className="flex flex-col items-end gap-2">
        {open ? (
          <div className="w-[280px] rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur">
            <div className="mb-3 flex items-center justify-between">
                <p className="text-[12px] font-black text-slate-800">개발자 KPI</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-600"
              >
                닫기
              </button>
            </div>
            <div className="space-y-2 text-[12px] text-slate-700">
              <div className="flex items-center justify-between">
                <span className="font-semibold">시스템 지연</span>
                <span className="font-mono">{clinicalMetrics.systemLatency}ms</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold">추적 정밀도</span>
                <span className="font-mono">
                  {clinicalMetrics.trackingPrecision.toFixed(2)}mm
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold">분석 안정성</span>
                <span className="font-mono">
                  {clinicalMetrics.stability.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold">실행 상태</span>
                <span className="font-mono text-right">
                  {runtimeStatus.message || (runtimeStatus.saving
                    ? "저장 중"
                    : runtimeStatus.needsRetry
                      ? "재시도 필요"
                      : runtimeStatus.pageError
                        ? "오류"
                        : runtimeStatus.recording
                          ? "녹음 중"
                          : "정상")}
                </span>
              </div>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="rounded-full border border-slate-300 bg-white/95 px-3 py-2 text-[12px] font-black text-slate-700 shadow-lg backdrop-blur"
        >
          {open ? "KPI 숨기기" : "KPI 보기"}
        </button>
      </div>
    </div>
  );
}
