import type { SttUseCase } from "@/lib/speech/sttPolicy";

export type WasmSttResult = {
  text: string;
  confidence: number;
  engineVersion: string;
};

export type WasmSttOptions = {
  targetText?: string;
  useCase: SttUseCase;
};

export function isWasmSttAvailable() {
  return false;
}

export async function transcribeWithWasmStt(
  _audioBlob: Blob,
  _options: WasmSttOptions,
): Promise<WasmSttResult> {
  throw new Error("wasm_stt_unavailable");
}
