// braintalktalk/next.config.ts
//
// 보안 헤더 정책 (식약처 사이버보안 가이드라인 + OWASP 권고).
// - HSTS: HTTPS 강제 (운영에서만; localhost dev 는 영향 없음)
// - CSP: 스크립트/스타일/미디어/이미지 기본 self, 필요한 외부 출처만 명시
//        Tailwind/inline style 사용으로 'unsafe-inline' 은 style 에 한정.
//        WebSocket 은 dev 시 _next/webpack-hmr 용으로 ws: 허용.
// - X-Frame-Options: DENY — clickjacking 방지
// - X-Content-Type-Options: nosniff
// - Referrer-Policy: strict-origin-when-cross-origin
// - Permissions-Policy: 카메라·마이크는 self 만 (FaceTracker / 녹음 사용)

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const isProd = process.env.NODE_ENV === "production";

const cspDirectives = [
  "default-src 'self'",
  // Next.js 는 inline script (build hash) 가 필요. nonce 도입 전까지 'unsafe-inline'.
  // WASM-STT ONNX 런타임은 로컬 .mjs 를 blob URL 로 감싼 뒤 dynamic import 한다.
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://cdnjs.cloudflare.com https://cdn.jsdelivr.net`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `font-src 'self' https://fonts.gstatic.com data:`,
  `img-src 'self' data: blob: https:`,
  `media-src 'self' blob: data:`,
  `worker-src 'self' blob:`,
  // /api/proxy/* 가 OpenAI 로 나가는 통로. WASM-STT 모델/런타임은 public 정적 자산에서 self 로 로드한다.
  // storage.googleapis.com: XR Preview(/select-page/xr/*) 의 MediaPipe HandLandmarker 모델
  //   가중치 (hand_landmarker.task) 다운로드용. 정식 SaMD 빌드 전에 모델을
  //   public/mediapipe/models/ 에 동봉하면 이 출처 제거 가능.
  `connect-src 'self' https://api.openai.com https://storage.googleapis.com${isProd ? "" : " ws: http://localhost:* http://127.0.0.1:*"}`,
  `frame-ancestors 'none'`,
  `form-action 'self'`,
  `base-uri 'self'`,
  `object-src 'none'`,
];

const securityHeaders: { key: string; value: string }[] = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=(), payment=()",
  },
  { key: "Content-Security-Policy", value: cspDirectives.join("; ") },
];

if (isProd) {
  // HSTS 는 HTTPS 운영에서만. dev 에 들어가면 localhost 가 깨진다.
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  });
}

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true, // 타입 에러 무시
  },
  webpack(config: {
    resolve?: { alias?: Record<string, string> };
  }) {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "onnxruntime-web/webgpu": require.resolve("onnxruntime-web/webgpu"),
    };
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      { source: "/mode-select", destination: "/select-page/mode", permanent: false },
      { source: "/select", destination: "/select-page/self-assessment", permanent: false },
      { source: "/rehab", destination: "/select-page/speech-rehab", permanent: false },
      { source: "/select-sing", destination: "/select-page/sing-training", permanent: false },
      { source: "/brain-sing", destination: "/programs/sing-training", permanent: false },
      { source: "/step-1", destination: "/programs/step-1", permanent: false },
      { source: "/step-2", destination: "/programs/step-2", permanent: false },
      { source: "/step-3", destination: "/programs/step-3", permanent: false },
      { source: "/step-4", destination: "/programs/step-4", permanent: false },
      { source: "/step-5", destination: "/programs/step-5", permanent: false },
      { source: "/step-6", destination: "/programs/step-6", permanent: false },
      { source: "/result", destination: "/result-page/self-assessment", permanent: false },
      { source: "/result-rehab", destination: "/result-page/speech-rehab", permanent: false },
    ];
  },
};
export default nextConfig;
