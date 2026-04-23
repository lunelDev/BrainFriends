import type React from "react";
import type { AcousticSnapshot } from "@/lib/kwab/SessionManager";

/**
 * Step2 발화 카드 안에 표시되는 Parselmouth 음향 측정값 블록.
 *
 * SaMD 표시 정책 (REQ-ACOUSTIC-001~004):
 * - measurement_quality === "failed" → 표시하지 않음(silent skip).
 * - measurement_quality === "degraded" → 노란 뱃지 + 측정 가능한 값만 표시.
 * - measurement_quality === "measured" → 회색 박스 + 4지표 표시.
 *
 * 이 값은 결과 화면 "참고 측정값"이며, 현재 점수 산정(C 작업 영역)에는
 * 영향을 주지 않는다. 점수에 통합하려면 별도 V&V/임상 합의 절차 필요.
 */
type Props = {
  acoustic: AcousticSnapshot | null | undefined;
};

function fmtHz(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "—";
  }
  return `${Math.round(Number(value))}Hz`;
}

function fmtDb(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "—";
  }
  return `${Number(value).toFixed(1)}dB`;
}

function fmtSec(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "—";
  }
  return `${Number(value).toFixed(2)}초`;
}

function fmtRatio(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "—";
  }
  // voicing_ratio 는 0~1 비율로 가정. 만약 이미 % 라면 100을 안 넘는 한 그대로.
  const num = Number(value);
  const pct = num <= 1 ? num * 100 : num;
  return `${Math.round(pct)}%`;
}

export function Step2AcousticBlock({ acoustic }: Props) {
  return <AcousticBlockImpl acoustic={acoustic} />;
}

/**
 * step-2 외 step-4/step-5/sing-training 등 다른 발화 측정 카드에서도
 * 동일한 표시 정책으로 재사용하기 위한 일반화된 별칭.
 * 내부 구현은 동일하다.
 */
export function AcousticBlock({ acoustic }: Props) {
  return <AcousticBlockImpl acoustic={acoustic} />;
}

function AcousticBlockImpl({ acoustic }: Props) {
  if (!acoustic) return null;
  if (acoustic.measurement_quality === "failed") return null;

  const isDegraded = acoustic.measurement_quality === "degraded";

  const containerClass = isDegraded
    ? "mt-1 mb-2 rounded-md border border-amber-200 bg-amber-50/60 px-2 py-1.5"
    : "mt-1 mb-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5";

  const labelClass = isDegraded
    ? "text-[9px] font-black uppercase tracking-widest text-amber-700"
    : "text-[9px] font-black uppercase tracking-widest text-slate-500";

  return (
    <div className={containerClass}>
      <div className="flex items-center justify-between mb-1">
        <span className={labelClass}>음향 측정 (참고)</span>
        {isDegraded && (
          <span className="text-[9px] font-black text-amber-700 bg-amber-100 border border-amber-200 px-1 py-px rounded">
            일부 측정
          </span>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5">
        <div className="flex items-baseline justify-between gap-1">
          <dt className="text-[10px] font-bold text-slate-500">발화 시간</dt>
          <dd className="text-[11px] font-black text-slate-800">
            {fmtSec(acoustic.duration_sec)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-1">
          <dt className="text-[10px] font-bold text-slate-500">평균 음높이</dt>
          <dd className="text-[11px] font-black text-slate-800">
            {fmtHz(acoustic.f0?.mean_hz)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-1">
          <dt className="text-[10px] font-bold text-slate-500">평균 음량</dt>
          <dd className="text-[11px] font-black text-slate-800">
            {fmtDb(acoustic.intensity?.mean_db)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-1">
          <dt className="text-[10px] font-bold text-slate-500">유성음 비율</dt>
          <dd className="text-[11px] font-black text-slate-800">
            {fmtRatio(acoustic.voicing_ratio)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
