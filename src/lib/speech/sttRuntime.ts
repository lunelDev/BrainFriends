import {
  parseBooleanFlag,
  resolveSttPolicy,
  type SttEngine,
  type SttUseCase,
} from "@/lib/speech/sttPolicy";

export type SttRuntimeState = {
  engine: SttEngine;
  useCase: SttUseCase;
  reason: string;
  rawAudioLeavesDevice: boolean;
  canUploadToServer: boolean;
  isMock: boolean;
  wasmAvailable: boolean;
};

function isBrowserWasmAudioAvailable(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof WebAssembly === "undefined") return false;
  const w = window as unknown as {
    AudioContext?: unknown;
    webkitAudioContext?: unknown;
  };
  return Boolean(w.AudioContext || w.webkitAudioContext);
}

export function resolveSttRuntime(params: {
  useCase: SttUseCase;
  devMode?: boolean;
  wasmAvailable?: boolean;
  allowTrainingServerFallback?: boolean;
  allowWasmExperiment?: boolean;
}): SttRuntimeState {
  const wasmAvailable = params.wasmAvailable ?? isBrowserWasmAudioAvailable();
  const policy = resolveSttPolicy({
    useCase: params.useCase,
    devMode:
      params.devMode ??
      parseBooleanFlag(process.env.NEXT_PUBLIC_DEV_MODE, false),
    wasmAvailable,
    allowTrainingServerFallback:
      params.allowTrainingServerFallback ??
      parseBooleanFlag(process.env.NEXT_PUBLIC_STT_TRAINING_SERVER_FALLBACK, false),
    allowWasmExperiment:
      params.allowWasmExperiment ??
      parseBooleanFlag(process.env.NEXT_PUBLIC_STT_WASM_EXPERIMENT, false),
  });

  return {
    engine: policy.engine,
    useCase: params.useCase,
    reason: policy.reason,
    rawAudioLeavesDevice: policy.rawAudioLeavesDevice,
    canUploadToServer: policy.engine === "server_whisper",
    isMock: policy.engine === "mock_stt",
    wasmAvailable,
  };
}
