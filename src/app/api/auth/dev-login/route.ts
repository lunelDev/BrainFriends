import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  authenticateAccount,
} from "@/lib/server/accountAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const isSecureRequest = new URL(req.url).protocol === "https:";

  try {
    const authenticated = await authenticateAccount({
      loginId: "admin",
      password: "0000",
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
    const message =
      error instanceof Error ? error.message : "failed_to_create_dev_session";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
