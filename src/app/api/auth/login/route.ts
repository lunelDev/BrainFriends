import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  authenticateAccount,
} from "@/lib/server/accountAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const isSecureRequest = new URL(req.url).protocol === "https:";
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { ok: false, error: "invalid_login_payload" },
      { status: 400 },
    );
  }

  try {
    const authenticated = await authenticateAccount({
      loginId: String(body.loginId ?? ""),
      password: String(body.password ?? ""),
    });

    const response = NextResponse.json({
      ok: true,
      patient: authenticated.patient,
    });
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: authenticated.sessionToken,
      httpOnly: true,
      sameSite: "lax",
      secure: isSecureRequest,
      expires: authenticated.expiresAt,
      path: "/",
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed_to_login";
    const status =
      message === "invalid_login_payload"
        ? 400
        : message === "invalid_credentials"
          ? 401
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
