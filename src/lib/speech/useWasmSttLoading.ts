"use client";

// React hook — wasmSttLoadingState 머신 통합.
//
// 사용 예 (sentence-magic / sing-training / step-1):
//
//   const { state, beginLoad, finishLoad, fail, reset } = useWasmSttLoading();
//   beginLoad();
//   try {
//     const r = await transcribeWithWasmStt(blob, { useCase: "daily_training" });
//     finishLoad();
//   } catch (e) {
//     fail(e instanceof Error ? e.message : "unknown");
//   }
//   <WasmSttLoadingIndicator state={state} onRetry={reset} />

import { useCallback, useState } from "react";
import {
  INITIAL_WASM_STT_LOADING_STATE,
  markFailed,
  markReady,
  reset as resetState,
  startLoading,
  type WasmSttLoadingState,
} from "@/lib/speech/wasmSttLoadingState";
import { WASM_STT_MODEL_ID } from "@/lib/speech/wasmSttAdapter";

export function useWasmSttLoading() {
  const [state, setState] = useState<WasmSttLoadingState>(
    INITIAL_WASM_STT_LOADING_STATE,
  );

  const beginLoad = useCallback(() => {
    setState((prev) =>
      startLoading(prev, {
        modelId: WASM_STT_MODEL_ID,
        startedAtMs: Date.now(),
      }),
    );
  }, []);

  const finishLoad = useCallback(() => {
    setState((prev) => markReady(prev, { finishedAtMs: Date.now() }));
  }, []);

  const fail = useCallback((errorCode: string) => {
    setState((prev) =>
      markFailed(prev, { errorCode, finishedAtMs: Date.now() }),
    );
  }, []);

  const reset = useCallback(() => {
    setState(resetState());
  }, []);

  return { state, beginLoad, finishLoad, fail, reset };
}
