import React from "react";

export default function SafetyDisclaimer() {
  return (
    <div className="rounded-2xl border bg-white p-4 text-sm text-neutral-700 shadow-sm">
      <p className="font-semibold">안전 안내 (SaMD)</p>
      <p className="mt-2 leading-relaxed">
        본 서비스는 자동 판정이 아닌 판단 보조용이며, 의료진/전문가의 임상적
        판단을 대체하지 않습니다. 사용 결과는 참고 자료로 활용되어야 하며, 이상
        징후가 있는 경우 전문가 상담이 필요합니다.
      </p>
      <p className="mt-2 text-xs text-neutral-500">
        * 모니터링/지표 및 분석 결과는 센서/모델 연동 전까지 Mock 데이터로
        표시될 수 있습니다.
      </p>
    </div>
  );
}
