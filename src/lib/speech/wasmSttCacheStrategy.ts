// SR-WASM-STT-CACHE. Service Worker 측 모델 다운로드 캐싱 결정성 helper.
//
// transformers.js 가 IndexedDB 자동 캐싱을 하지만, Service Worker 레벨에서 모델
// 자산 (huggingface.co/Xenova/whisper-tiny/*) 의 fetch 를 stale-while-revalidate
// 로 잡아두면 (1) 오프라인 동작, (2) 첫 다운로드 진행률 표시 통합이 가능하다.
//
// 본 모듈은 캐시 정책 결정성 함수만 제공한다. sw.js 의 실제 install/activate/fetch
// 핸들러는 별도 (public/sw.js) 단순 wrapper.

export type CacheDecision = "cache_first" | "network_first" | "bypass";

export interface CacheStrategyInput {
  url: string;
  /** HTTP method, GET 만 캐싱 대상. */
  method: string;
  /** dev mode 에서는 bypass. */
  isDevMode: boolean;
}

const MODEL_URL_PATTERNS = [
  /huggingface\.co\/Xenova\/whisper/,
  /cdn-lfs\.huggingface\.co\/.*whisper/,
  /onnx-community\/whisper/,
] as const;

const STATIC_ASSET_EXTENSIONS = [
  ".onnx",
  ".bin",
  ".json",
  ".tokenizer.json",
] as const;

export function decideCacheStrategy(input: CacheStrategyInput): CacheDecision {
  if (input.method !== "GET") return "bypass";
  if (input.isDevMode) return "bypass";

  // Whisper 모델 자산 — cache-first (한번 받으면 영구)
  if (MODEL_URL_PATTERNS.some((p) => p.test(input.url))) {
    return "cache_first";
  }
  // 기타 huggingface 자산 + ONNX/bin 확장자
  if (
    input.url.includes("huggingface.co") &&
    STATIC_ASSET_EXTENSIONS.some((ext) => input.url.endsWith(ext))
  ) {
    return "cache_first";
  }

  // 기타 CDN — bypass (Service Worker 가 일반 트래픽 가로채지 않음)
  return "bypass";
}

export const WASM_STT_CACHE_NAME = "wasm-stt-models-v1" as const;
