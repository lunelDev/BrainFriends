"use client";

import React, { useState } from "react";
import type { EstimatedKpiMetric } from "@/features/report/utils/validationEstimates";

export function ReportDeveloperKpiPanel({
  metrics,
  passCount,
  failCount,
  pendingCount,
}: {
  metrics: EstimatedKpiMetric[];
  passCount: number;
  failCount: number;
  pendingCount: number;
}) {
  const [open, setOpen] = useState(false);

  const formatStatus = (status: "PASS" | "FAIL" | "PENDING") => {
    if (status === "PASS") return "통과";
    if (status === "FAIL") return "주의";
    return "대기";
  };

  if (process.env.NODE_ENV !== "development" || metrics.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-[140] no-print">
      <div className="flex flex-col items-start gap-2">
        {open ? (
          <div className="w-[360px] rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[12px] font-black text-slate-800">
                  리포트 검증 KPI
                </p>
                <p className="mt-1 text-[11px] font-bold text-slate-500">
                  측정 완료 표본 기준 · 통과 {passCount} · 주의 {failCount} · 대기 {pendingCount}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-600"
              >
                닫기
              </button>
            </div>
            <div className="space-y-2">
              {metrics.map((metric) => (
                <div
                  key={metric.key}
                  className={`rounded-xl border px-3 py-2 text-[12px] ${
                    metric.status === "PASS"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : metric.status === "FAIL"
                        ? "border-red-200 bg-red-50 text-red-800"
                        : "border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-black">{metric.label}</span>
                    <span className="font-mono font-black">
                      {metric.value === null ? "N/A" : `${metric.value}${metric.unit}`}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3 text-[11px]">
                    <span>{metric.thresholdLabel}</span>
                    <span className="font-black">{formatStatus(metric.status)}</span>
                  </div>
                  {metric.note ? (
                    <p className="mt-1 text-[11px] leading-snug opacity-80">{metric.note}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="rounded-full border border-slate-300 bg-white/95 px-3 py-2 text-[12px] font-black text-slate-700 shadow-lg backdrop-blur"
        >
          {open ? "리포트 KPI 숨기기" : "리포트 KPI 보기"}
        </button>
      </div>
    </div>
  );
}
