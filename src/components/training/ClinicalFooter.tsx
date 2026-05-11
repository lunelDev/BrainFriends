// src/components/training/ClinicalFooter.tsx
// 내부 개발 참고용 측정값 표시 컴포넌트.
// claim-lock §5 준수 — 정량 임상 성능 수치(예: ≥95.2%, ICC≥0.82)는
// 임상 검증 결과가 아니므로 화면에 목표/임계값 형태로 노출하지 않는다.
// 라벨도 임상 측정학 용어(임상적 상관성, 신뢰도, 정확도) 사용을 피하고
// 단순 측정 지표 표시로 한정한다.
import React from "react";
import { useTraining } from "@/app/(training)/TrainingContext";

export default function ClinicalFooter() {
  const { clinicalMetrics } = useTraining();

  return (
    <div className="h-12 bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-200 px-6 flex items-center justify-between text-[10px] font-mono">
      <span className="text-gray-400 italic">
        내부 개발 참고용 측정값 — 임상 검증 수치 아님
      </span>
      <MetricItem label="지연" value={`${clinicalMetrics.systemLatency.toFixed(1)}ms`} />
      <MetricItem label="트래킹" value={`${clinicalMetrics.trackingPrecision.toFixed(2)}mm`} />
      <MetricItem label="음성 측정" value={`${clinicalMetrics.analysisAccuracy.toFixed(1)}%`} />
      <MetricItem label="상관" value={`r ${clinicalMetrics.correlation.toFixed(2)}`} />
      <MetricItem label="반복" value={`ICC ${clinicalMetrics.reliability.toFixed(2)}`} />
      <MetricItem label="변동" value={`CV ${clinicalMetrics.stability.toFixed(1)}%`} />
    </div>
  );
}

// ============================================================================
// MetricItem 컴포넌트 — 목표/합격 색상 표시는 제거 (임상 검증 인상 차단)
// ============================================================================

interface MetricItemProps {
  label: string;
  value: string;
}

function MetricItem({ label, value }: MetricItemProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-500 font-semibold">{label}:</span>
      <span className="font-black text-slate-700">{value}</span>
    </div>
  );
}
