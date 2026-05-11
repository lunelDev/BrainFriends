// WASM STT adapter — transformers.js (@huggingface/transformers) 기반 온디바이스 Whisper.
//
// 클레임 잠금 §3 "안면·시선 분석은 온디바이스, STT 는 사용 목적별 정책" + §4 STT 행 정합.
// 제품 STT 경로에서는 호출하지 않는다. /dev/wasm-stt-test 에서만 실험 후보로 직접 호출한다.
//
// 본 모듈은 SSR (server) 에서는 자동으로 unavailable 로 보고된다 (window/WebAssembly 미존재).
// V&V 결정성 함수가 Node 환경에서 isWasmSttAvailable()=false 를 가정하고 있으므로,
// 본 파일은 절대 module top-level 에서 transformers.js 를 import 하지 않는다 (lazy import).

import type { SttUseCase } from "@/lib/speech/sttPolicy";
import { STT_WASM_LANGUAGE } from "@/lib/speech/sttLanguage";

/** Stable identifier — release manifest 의 model 자산으로 추적된다. */
export const WASM_STT_MODEL_ID = "Xenova/whisper-tiny" as const;
export const WASM_STT_MODEL_DTYPE = "fp32" as const;
export const WASM_STT_LOCAL_MODEL_BASE_PATH = "/models/wasm-stt/" as const;
export const WASM_STT_LOCAL_ONNX_WASM_PATH =
  "/vendor/onnxruntime/ort-wasm-simd-threaded.asyncify.wasm" as const;
export const WASM_STT_LOCAL_ONNX_MJS_PATH =
  "/vendor/onnxruntime/ort-wasm-simd-threaded.asyncify.mjs" as const;
export const WASM_STT_PACKAGE_VERSION = "4.2.0" as const;
export const WASM_STT_ENGINE_VERSION =
  `transformers.js@${WASM_STT_PACKAGE_VERSION}:${WASM_STT_MODEL_ID}:${WASM_STT_MODEL_DTYPE}:local-assets:v0.2` as const;

/** 입력 오디오 샘플레이트 — Whisper 모델 요구. */
export const WASM_STT_SAMPLE_RATE = 16000 as const;

export type WasmSttResult = {
  text: string;
  confidence: number;
  engineVersion: string;
};

export type WasmSttOptions = {
  targetText?: string;
  useCase: SttUseCase;
};

/**
 * Whisper transformers.js 의 task 출력 — 본 모듈에서 사용하는 최소 부분만 좁혀둔다.
 * 외부 라이브러리 타입 변경에 대한 결정성 안전망.
 */
type RawTranscriptionOutput =
  | { text?: unknown }
  | Array<{ text?: unknown }>
  | null
  | undefined;

type TransformersModule = {
  env: {
    allowRemoteModels: boolean;
    allowLocalModels: boolean;
    localModelPath: string;
    useBrowserCache: boolean;
    useWasmCache: boolean;
    backends: {
      onnx?: {
        wasm?: {
          wasmPaths?: string | { wasm: string; mjs: string };
          proxy?: boolean;
        };
      };
    };
  };
  pipeline: (
    task: string,
    model: string,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
};

let pipelineInstance: unknown | null = null;
let pipelinePromise: Promise<unknown> | null = null;

function configureLocalTransformersRuntime(mod: TransformersModule): void {
  mod.env.allowRemoteModels = false;
  mod.env.allowLocalModels = true;
  mod.env.localModelPath = WASM_STT_LOCAL_MODEL_BASE_PATH;
  mod.env.useBrowserCache = true;
  mod.env.useWasmCache = true;
  mod.env.backends.onnx ??= {};
  mod.env.backends.onnx.wasm ??= {};
  mod.env.backends.onnx.wasm.proxy = false;
  mod.env.backends.onnx.wasm.wasmPaths = {
    wasm: WASM_STT_LOCAL_ONNX_WASM_PATH,
    mjs: WASM_STT_LOCAL_ONNX_MJS_PATH,
  };
}

/**
 * 브라우저 + WASM 지원 환경에서만 true. SSR / Node V&V / 비호환 브라우저 → false.
 *
 * 결정성 보장: 동일 환경에서 동일 결과. 본 함수는 부작용이 없다.
 */
export function isWasmSttAvailable(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof WebAssembly === "undefined") return false;
  // AudioContext 가 있어야 Blob → Float32Array 변환이 가능하다.
  const w = window as unknown as {
    AudioContext?: unknown;
    webkitAudioContext?: unknown;
  };
  if (!w.AudioContext && !w.webkitAudioContext) return false;
  return true;
}

/**
 * Lazy 로 transformers.js pipeline 을 생성한다. 동일 세션 내에서는 단일 인스턴스 캐싱.
 * 로컬 모델 자산은 첫 호출 시 브라우저 런타임으로 적재된다. transformers.js 가 IndexedDB 에 자동 캐싱.
 */
async function ensurePipeline(): Promise<unknown> {
  if (pipelineInstance) return pipelineInstance;
  if (pipelinePromise) return pipelinePromise;

  pipelinePromise = (async () => {
    // Dynamic import — server bundle / V&V 환경에서 모듈 전체가 평가되지 않게 한다.
    const mod = (await import("@huggingface/transformers")) as unknown as TransformersModule;
    configureLocalTransformersRuntime(mod);
    const transcriber = await mod.pipeline(
      "automatic-speech-recognition",
      WASM_STT_MODEL_ID,
      {
        device: "wasm",
        dtype: WASM_STT_MODEL_DTYPE,
        local_files_only: true,
      },
    );
    pipelineInstance = transcriber;
    return transcriber;
  })().catch((error) => {
    // 캐싱 실패 시 promise 를 비워서 다음 호출에 재시도 가능하게 한다.
    pipelinePromise = null;
    throw error;
  });

  return pipelinePromise;
}

/**
 * Blob → 16kHz mono Float32Array. Whisper 입력 사양.
 * 브라우저 AudioContext 만 사용 (no native fetch / no node-only API).
 */
async function decodeBlobTo16kMono(blob: Blob): Promise<Float32Array> {
  if (typeof window === "undefined") {
    throw new Error("wasm_stt_no_browser_audio_context");
  }
  const w = window as unknown as {
    AudioContext: new (options?: AudioContextOptions) => AudioContext;
    webkitAudioContext?: new (options?: AudioContextOptions) => AudioContext;
  };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) {
    throw new Error("wasm_stt_no_browser_audio_context");
  }
  const audioContext = new Ctor({ sampleRate: WASM_STT_SAMPLE_RATE });
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    // 다채널이면 채널 0 만 사용 (Whisper 는 mono).
    const channelData = audioBuffer.getChannelData(0);
    return Float32Array.from(channelData);
  } finally {
    // AudioContext 누수 방지.
    if (typeof audioContext.close === "function") {
      audioContext.close().catch(() => undefined);
    }
  }
}

/**
 * Whisper transformers.js 결과로부터 결정성 텍스트 추출.
 * 응답 형식이 string / array / nested 다양해서 좁혀둔다.
 */
function extractTranscriptText(raw: RawTranscriptionOutput): string {
  if (!raw) return "";
  if (Array.isArray(raw)) {
    return raw
      .map((entry) => (typeof entry?.text === "string" ? entry.text : ""))
      .join(" ")
      .trim();
  }
  if (typeof raw === "object" && "text" in raw && typeof raw.text === "string") {
    return raw.text.trim();
  }
  return "";
}

/**
 * 온디바이스 Whisper 로 전사. 한국어 task=transcribe.
 *
 * 결과:
 * - text: 전사 결과 (앞뒤 공백 제거)
 * - confidence: 텍스트가 비어 있지 않으면 0.85 (transformers.js 의 simple ASR API 가
 *   token-level confidence 를 노출하지 않으므로 v0.1 에서는 fixed 값 사용. 후속 release
 *   에서 logits 기반 산출로 교체 예정)
 * - engineVersion: WASM_STT_ENGINE_VERSION 상수
 *
 * 환경 미지원 / 모델 로드 실패는 명시 에러:
 * - "wasm_stt_unavailable" — isWasmSttAvailable() false
 * - "wasm_stt_no_browser_audio_context" — AudioContext 미존재
 * - "wasm_stt_model_load_failed" — pipeline 생성 실패
 * - "wasm_stt_transcription_failed" — 추론 단계 실패
 */
export async function transcribeWithWasmStt(
  audioBlob: Blob,
  options: WasmSttOptions,
): Promise<WasmSttResult> {
  if (!isWasmSttAvailable()) {
    throw new Error("wasm_stt_unavailable");
  }

  let transcriber: unknown;
  try {
    transcriber = await ensurePipeline();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    throw new Error(`wasm_stt_model_load_failed:${reason}`);
  }

  const audio = await decodeBlobTo16kMono(audioBlob);

  let raw: RawTranscriptionOutput;
  try {
    raw = (await (
      transcriber as (
        input: Float32Array,
        options?: Record<string, unknown>,
      ) => Promise<RawTranscriptionOutput>
    )(audio, {
      language: STT_WASM_LANGUAGE,
      task: "transcribe",
      // chunk_length_s 등 추가 옵션은 v0.2 에서 도입.
    })) as RawTranscriptionOutput;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    throw new Error(`wasm_stt_transcription_failed:${reason}`);
  }

  const text = extractTranscriptText(raw);
  // useCase 는 호출자 추적용 — 현재 결정성 알고리즘에는 영향 없음.
  void options.useCase;
  void options.targetText;

  return {
    text,
    confidence: text.length > 0 ? 0.85 : 0,
    engineVersion: WASM_STT_ENGINE_VERSION,
  };
}

/**
 * 테스트/V&V 보조: 캐싱된 pipeline 인스턴스를 비운다.
 * 결정성 V&V 가 모듈 상태 격리를 보장하기 위해 사용.
 */
export function __resetWasmSttPipelineForTest(): void {
  pipelineInstance = null;
  pipelinePromise = null;
}
