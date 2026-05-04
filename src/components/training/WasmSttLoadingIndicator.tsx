"use client";

// WASM STT 모델 로딩 인디케이터 React 컴포넌트.
//
// `src/lib/speech/wasmSttLoadingState.ts` (SR-WASM-STT-LOADING) 상태 머신과 결합.
// claim-lock §3 "WASM 온디바이스 STT (훈련 useCase)" 행의 사용자 경험 보장.
//
// 본 컴포넌트는 stateless presentation 만 담당 — 실제 상태는 부모가 관리.
// sentence-magic / sing-training / step-1 통합 시 부모 컴포넌트가
// useState<WasmSttLoadingState>(INITIAL_WASM_STT_LOADING_STATE) 로 보유.

import type { WasmSttLoadingState } from "@/lib/speech/wasmSttLoadingState";

export interface WasmSttLoadingIndicatorProps {
  state: WasmSttLoadingState;
  /** 사용자가 실패 후 재시도 클릭 시 호출. */
  onRetry?: () => void;
  /** 추가 className. */
  className?: string;
  /** 진행률 바 색상 — Tailwind 클래스. 기본 indigo. */
  barColorClassName?: string;
}

export function WasmSttLoadingIndicator({
  state,
  onRetry,
  className,
  barColorClassName,
}: WasmSttLoadingIndicatorProps) {
  // not_started 일 때는 표시 안 함 (parent 가 mount/unmount 처리하지 않을 경우 안전망)
  if (state.phase === "not_started") return null;

  const barColor = barColorClassName ?? "bg-indigo-500";
  const containerClass = [
    "w-full rounded-md border p-3 text-sm",
    state.phase === "failed"
      ? "border-red-300 bg-red-50 text-red-800"
      : state.phase === "ready"
        ? "border-green-300 bg-green-50 text-green-800"
        : "border-gray-200 bg-gray-50 text-gray-800",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const progressPct = Math.round(state.progress * 100);

  return (
    <div
      className={containerClass}
      role="status"
      aria-live="polite"
      data-stt-phase={state.phase}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{state.message}</span>
        {state.phase === "failed" && onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="text-xs underline underline-offset-2 hover:no-underline"
          >
            다시 시도
          </button>
        ) : null}
      </div>

      {state.phase === "loading" ? (
        <div className="mt-2 h-2 w-full overflow-hidden rounded bg-gray-200">
          <div
            className={`h-full transition-[width] duration-200 ${barColor}`}
            style={{ width: `${progressPct}%` }}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPct}
            role="progressbar"
          />
        </div>
      ) : null}

      {state.modelId ? (
        <div className="mt-2 text-xs text-gray-500">
          모델: {state.modelId}
          {state.startedAtMs && state.finishedAtMs ? (
            <>
              {" "}
              · 소요 {Math.round((state.finishedAtMs - state.startedAtMs) / 100) /
                10}{" "}
              초
            </>
          ) : null}
        </div>
      ) : null}

      {state.phase === "failed" && state.errorCode ? (
        <div className="mt-1 text-xs text-red-600">
          오류 코드: <code>{state.errorCode}</code>
        </div>
      ) : null}
    </div>
  );
}

export default WasmSttLoadingIndicator;
