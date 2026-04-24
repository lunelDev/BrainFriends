import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "brainfriends_session";
const PROTECTED_PREFIXES = [
  "/select-page",
  "/programs",
  "/report",
  "/result-page",
  "/tools",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(AUTH_COOKIE_NAME)?.value);
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !hasSession) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // "/" · "/signup" 에서 세션만 보고 /select-page/mode 로 강제 리다이렉트하던
  // 과거 규칙은 제거 — 역할(admin/therapist/patient) 을 모르고 환자 홈으로만
  // 튕겨서 치료사·관리자 계정이 로그인해도 환자 화면이 열리는 문제가 있었음.
  // 역할별 라우팅은 src/app/page.tsx 의 routeAfterAuth() 가 세션을 읽어
  // /admin, /therapist, /select-page/mode 중 맞는 곳으로 보낸다.

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/signup", "/select-page/:path*", "/programs/:path*", "/report", "/result-page/:path*", "/tools/:path*"],
};
