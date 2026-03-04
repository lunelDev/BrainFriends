import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import Script from "next/script";

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
  variable: "--font-noto-sans-kr",
});

export const metadata: Metadata = {
  title: "브레인프렌즈 GOLDEN",
  description: "SaMD 기반 언어 재활 훈련",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* ✅ Next.js 표준 방식으로 스크립트 로드 순서 고정 */}
        <Script
          src="https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js"
          strategy="beforeInteractive"
        />
        <Script
          src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"
          strategy="beforeInteractive"
        />
        {/* ✅ 안면 레이어(그물망) 드로잉을 위해 반드시 필요 */}
        <Script
          src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js"
          strategy="beforeInteractive"
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${notoSansKr.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
