import {
  parseBooleanFlag,
  resolveSttPolicy,
  type SttEngine,
  type SttUseCase,
} from "@/lib/speech/sttPolicy";
import { isWasmSttAvailable } from "@/lib/speech/wasmSttAdapter";

export type SttRuntimeState = {
  engine: SttEngine;
  useCase: SttUseCase;
  reason: string;
  rawAudioLeavesDevice: boolean;
  canUploadToServer: boolean;
  isMock: boolean;
  wasmAvailable: boolean;
};

export function resolveSttRuntime(params: {
  useCase: SttUseCase;
  devMode?: boolean;
  wasmAvailable?: boolean;
  allowTrainingServerFallback?: boolean;
}): SttRuntimeState {
  const wasmAvailable = params.wasmAvailable ?? isWasmSttAvailable();
  const policy = resolveSttPolicy({
    useCase: params.useCase,
    devMode:
      params.devMode ??
      parseBooleanFlag(process.env.NEXT_PUBLIC_DEV_MODE, false),
    wasmAvailable,
    allowTrainingServerFallback:
      params.allowTrainingServerFallback ??
      parseBooleanFlag(process.env.NEXT_PUBLIC_STT_TRAINING_SERVER_FALLBACK, false),
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
