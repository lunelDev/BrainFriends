import type { SttEngine, SttUseCase } from "@/lib/speech/sttPolicy";
import { resolveSttRuntime } from "@/lib/speech/sttRuntime";

export type ClientSttPreflightDecision = {
  canUploadToServer: boolean;
  sttUseCase: SttUseCase;
  reason: string;
  rawAudioLeavesDevice: boolean;
  engine: SttEngine;
  isMock: boolean;
  wasmAvailable: boolean;
};

export function resolveClientSttPreflight(params: {
  useCase: SttUseCase;
  wasmAvailable?: boolean;
  allowTrainingServerFallback?: boolean;
}): ClientSttPreflightDecision {
  const runtime = resolveSttRuntime({
    useCase: params.useCase,
    wasmAvailable: params.wasmAvailable,
    allowTrainingServerFallback: params.allowTrainingServerFallback,
  });

  return {
    canUploadToServer: runtime.canUploadToServer,
    sttUseCase: params.useCase,
    reason: runtime.reason,
    rawAudioLeavesDevice: runtime.rawAudioLeavesDevice,
    engine: runtime.engine,
    isMock: runtime.isMock,
    wasmAvailable: runtime.wasmAvailable,
  };
}
