// brainfriends Service Worker — WASM STT 로컬 모델/런타임 캐싱.
// 결정성 캐시 정책은 빌드 시 src/lib/speech/wasmSttCacheStrategy.ts 와 동기화.
// 본 파일은 스켈레톤 — 실제 통합은 next-pwa 또는 workbox 도입 후 자동 생성.

const CACHE_NAME = "wasm-stt-models-v1";

const MODEL_PATTERNS = [
  /\/models\/wasm-stt\/Xenova\/whisper/,
  /\/vendor\/onnxruntime\/ort-wasm/,
  /huggingface\.co\/Xenova\/whisper/,
  /cdn-lfs\.huggingface\.co\/.*whisper/,
];

self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(self.clients.claim()),
);

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (!MODEL_PATTERNS.some((p) => p.test(event.request.url))) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response && response.status === 200) {
        cache.put(event.request, response.clone());
      }
      return response;
    }),
  );
});
