// SR-WASM-STT-LOADING. WASM Whisper 모델 로드 상태 머신 결정성 함수.
//
// claim-lock §3 "WASM 온디바이스 STT (훈련 useCase)" 행의 사용자 경험 지원.
// 모델 ~78MB 첫 다운로드 동안 사용자에게 정확한 진행 상태를 표시하기 위한
// 결정성 상태 머신. 본 모듈은 React/Vue/UI 프레임워크에 의존하지 않으며
// useState / store / RxJS 등 어떤 reactive 환경에서도 사용 가능.
//
// 실제 UI 컴포넌트 통합 (sentence-magic / sing-training / step-1) 은 다음 세션.

export type WasmSttLoadingPhase =
  | "not_started"
  | "loading"
  | "ready"
  | "failed";

export interface WasmSttLoadingState {
  phase: WasmSttLoadingPhase;
  /** 모델 다운로드 진행률 0~1 (loading 단계에서만 의미 있음). */
  progress: number;
  /** 사람이 읽는 메시지 — 한국어, UI 에 그대로 출력 가능. */
  message: string;
  /** failed 일 때만 의미 있음 — 어댑터가 throw 한 에러 코드. */
  errorCode: string | null;
  /** 모델 식별자 — release manifest 추적용. */
  modelId: string | null;
  /** 첫 다운로드 시작 시각 (ms). 캐시 hit 시 0. */
  startedAtMs: number | null;
  /** ready 또는 failed 도달 시각 (ms). */
  finishedAtMs: number | null;
}

export const INITIAL_WASM_STT_LOADING_STATE: WasmSttLoadingState = {
  phase: "not_started",
  progress: 0,
  message: "모델이 아직 로드되지 않았습니다.",
  errorCode: null,
  modelId: null,
  startedAtMs: null,
  finishedAtMs: null,
};

/** 진행률 0~1 사이로 클램프, NaN/음수는 0, 1 초과는 1. */
function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return Math.round(value * 10000) / 10000;
}

export function startLoading(
  prev: WasmSttLoadingState,
  params: { modelId: string; startedAtMs: number },
): WasmSttLoadingState {
  return {
    phase: "loading",
    progress: prev.phase === "loading" ? prev.progress : 0,
    message: "WASM Whisper 모델을 다운로드하고 있습니다…",
    errorCode: null,
    modelId: params.modelId,
    startedAtMs:
      prev.phase === "loading" && prev.startedAtMs !== null
        ? prev.startedAtMs
        : params.startedAtMs,
    finishedAtMs: null,
  };
}

export function reportProgress(
  prev: WasmSttLoadingState,
  progress: number,
): WasmSttLoadingState {
  // not_started 또는 ready/failed 에서는 progress 무시.
  if (prev.phase !== "loading") return prev;
  const next = clampProgress(progress);
  if (next === prev.progress) return prev; // no-op for stability
  return {
    ...prev,
    progress: next,
    message:
      next >= 1
        ? "모델 다운로드 완료. 초기화 중…"
        : `WASM Whisper 모델 다운로드 중 (${Math.round(next * 100)}%)…`,
  };
}

export function markReady(
  prev: WasmSttLoadingState,
  params: { finishedAtMs: number },
): WasmSttLoadingState {
  return {
    ...prev,
    phase: "ready",
    progress: 1,
    message: "음성 인식 모델 준비 완료.",
    errorCode: null,
    finishedAtMs: params.finishedAtMs,
  };
}

export function markFailed(
  prev: WasmSttLoadingState,
  params: { errorCode: string; finishedAtMs: number },
): WasmSttLoadingState {
  return {
    ...prev,
    phase: "failed",
    // 실패 시 진행률 보존 — 어디서 멈췄는지 디버깅용.
    message: friendlyMessageFor(params.errorCode),
    errorCode: params.errorCode,
    finishedAtMs: params.finishedAtMs,
  };
}

export function reset(): WasmSttLoadingState {
  return { ...INITIAL_WASM_STT_LOADING_STATE };
}

function friendlyMessageFor(errorCode: string): string {
  if (errorCode.startsWith("wasm_stt_unavailable")) {
    return "이 브라우저는 온디바이스 음성 인식을 지원하지 않습니다.";
  }
  if (errorCode.startsWith("wasm_stt_no_browser_audio_context")) {
    return "오디오 처리 기능이 제한되어 음성 인식을 시작할 수 없습니다.";
  }
  if (errorCode.startsWith("wasm_stt_model_load_failed")) {
    return "음성 인식 모델 다운로드에 실패했습니다. 네트워크 상태를 확인해주세요.";
  }
  if (errorCode.startsWith("wasm_stt_transcription_failed")) {
    return "음성 인식 중 오류가 발생했습니다. 다시 시도해주세요.";
  }
  return "음성 인식 모듈에 알 수 없는 오류가 발생했습니다.";
}

/**
 * 합법 상태 전이 — UI 통합 시 잘못된 호출 순서 방지용.
 * not_started → loading → (ready | failed)
 * ready / failed → reset → not_started
 */
export function isLegalTransition(
  from: WasmSttLoadingPhase,
  to: WasmSttLoadingPhase,
): boolean {
  if (from === to) return true; // idempotent updates allowed (progress)
  if (from === "not_started" && to === "loading") return true;
  if (from === "loading" && (to === "ready" || to === "failed")) return true;
  if ((from === "ready" || from === "failed") && to === "not_started")
    return true;
  return false;
}

/**
 * 다운로드 소요 시간 (ms). loading 진행 중이면 현재 시각 기반으로 elapsed.
 * ready/failed 에 도달했으면 finishedAtMs - startedAtMs.
 */
export function elapsedLoadingMs(
  state: WasmSttLoadingState,
  nowMs: number,
): number {
  if (state.startedAtMs === null) return 0;
  if (state.phase === "loading") {
    return Math.max(0, nowMs - state.startedAtMs);
  }
  if (state.finishedAtMs !== null) {
    return Math.max(0, state.finishedAtMs - state.startedAtMs);
  }
  return 0;
}
