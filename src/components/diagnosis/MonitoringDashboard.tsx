// src/components/diagnosis/MonitoringDashboard.tsx
"use client";

import React from "react";
import { METRIC_TARGETS } from "@/constants/config";
import { MetricsData } from "@/hooks/useHybridAnalysis";

const KPICard = ({ label, value, target, status = "OK" }: any) => (
  <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between min-h-[100px]">
    <div className="flex justify-between items-start">
      <span className="text-gray-400 text-[10px] font-black uppercase tracking-tight">
        {label}
      </span>
      <span
        className={`text-white text-[9px] px-1.5 py-0.5 rounded font-black italic ${
          status === "OK"
            ? "bg-orange-500"
            : status === "WARN"
              ? "bg-orange-600"
              : "bg-slate-700"
        }`}
      >
        {status}
      </span>
    </div>
    <div className="mt-2">
      <div className="text-xl font-black text-[#0B1A3A] tracking-tight leading-none">
        {value}
      </div>
      <div className="text-[9px] text-gray-400 mt-1 font-medium italic">
        Target {target}
      </div>
    </div>
  </div>
);

export default function MonitoringDashboard({
  metrics,
}: {
  metrics: MetricsData;
}) {
  // ✅ 안전한 데이터 접근을 위한 가드
  const face = metrics?.face || { symmetryScore: 0, openingRatio: 0 };

  return (
    <div className="space-y-6">
      {/* SECTION 1: 환자 안면 재활 데이터 */}
      <div>
        <h3 className="text-[11px] font-black text-orange-500 mb-3 ml-1 uppercase italic tracking-widest">
          Patient Rehab Status
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <KPICard
            label="Lip Symmetry"
            value={`${face.symmetryScore}%`}
            target="≥90%"
            status={face.symmetryScore >= 90 ? "OK" : "WARN"}
          />
          <KPICard
            label="Mouth Open"
            value={face.openingRatio}
            target="Active"
            status="OK"
          />
        </div>
      </div>

      {/* SECTION 2: SaMD 시스템 성능 데이터 (질문하신 6개 지표) */}
      <div>
        <h3 className="text-[11px] font-black text-gray-400 mb-3 ml-1 uppercase italic tracking-widest">
          System Reliability (SAMD)
        </h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <KPICard
            label="Latency"
            value={`${metrics.latencyMs}ms`}
            target={`≤${METRIC_TARGETS.latency}ms`}
            status={metrics.latencyMs <= METRIC_TARGETS.latency ? "OK" : "CRIT"}
          />
          <KPICard
            label="Precision"
            value={`${metrics.facePrecisionMm}mm`}
            target={`≤${METRIC_TARGETS.face}mm`}
            status={
              metrics.facePrecisionMm <= METRIC_TARGETS.face ? "OK" : "WARN"
            }
          />
          <KPICard
            label="Speech Acc."
            value={`${metrics.speechAccuracyPct}%`}
            target={`≥${METRIC_TARGETS.speech}%`}
            status={
              metrics.speechAccuracyPct >= METRIC_TARGETS.speech ? "OK" : "WARN"
            }
          />
          <KPICard
            label="Clinical R"
            value={metrics.clinicalR}
            target={`≥${METRIC_TARGETS.rValue}`}
            status={metrics.clinicalR >= METRIC_TARGETS.rValue ? "OK" : "WARN"}
          />
          <KPICard
            label="ICC"
            value={metrics.icc}
            target={`≥${METRIC_TARGETS.icc}`}
            status={metrics.icc >= METRIC_TARGETS.icc ? "OK" : "WARN"}
          />
          <KPICard
            label="Stability"
            value={`${metrics.stabilityPct}%`}
            target={`≤${METRIC_TARGETS.stability}%`}
            status={
              metrics.stabilityPct <= METRIC_TARGETS.stability ? "OK" : "WARN"
            }
          />
        </div>
      </div>
    </div>
  );
}
