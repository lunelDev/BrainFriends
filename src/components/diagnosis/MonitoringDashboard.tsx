// src/components/diagnosis/MonitoringDashboard.tsx
// 내부 개발/QA 참고용 측정 대시보드.
// claim-lock §5 준수 — 정량 임상 성능 임계값(예: ≥95.2%, r≥0.98, ICC≥0.82)을
// 화면에 "Target"으로 노출하지 않는다. "Clinical R", "Patient Rehab Status" 같은
// 임상 검증 인상을 주는 라벨은 내부 측정 라벨로 치환한다.
"use client";

import React from "react";
import { MetricsData } from "@/hooks/useHybridAnalysis";

const KPICard = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between min-h-[100px]">
    <div className="flex justify-between items-start">
      <span className="text-gray-400 text-[10px] font-black uppercase tracking-tight">
        {label}
      </span>
    </div>
    <div className="mt-2">
      <div className="text-xl font-black text-[#0B1A3A] tracking-tight leading-none">
        {value}
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
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800">
        내부 개발/QA 참고용 측정값입니다. 임상 검증 결과나 진단·치료 결정의 근거가 아닙니다.
      </div>

      {/* SECTION 1: 안면 측정 보조 지표 */}
      <div>
        <h3 className="text-[11px] font-black text-orange-500 mb-3 ml-1 uppercase italic tracking-widest">
          Face Sensor (Internal)
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <KPICard label="Lip Symmetry" value={`${face.symmetryScore}%`} />
          <KPICard label="Mouth Open" value={face.openingRatio} />
        </div>
      </div>

      {/* SECTION 2: 시스템 측정 보조 지표 */}
      <div>
        <h3 className="text-[11px] font-black text-gray-400 mb-3 ml-1 uppercase italic tracking-widest">
          System Sensor (Internal)
        </h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <KPICard label="Latency" value={`${metrics.latencyMs}ms`} />
          <KPICard label="Face Precision" value={`${metrics.facePrecisionMm}mm`} />
          <KPICard label="Speech Measure" value={`${metrics.speechAccuracyPct}%`} />
          <KPICard label="Correlation" value={metrics.clinicalR} />
          <KPICard label="Repeat" value={metrics.icc} />
          <KPICard label="Variability" value={`${metrics.stabilityPct}%`} />
        </div>
      </div>
    </div>
  );
}
