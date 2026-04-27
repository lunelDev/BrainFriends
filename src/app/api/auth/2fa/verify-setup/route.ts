// src/app/api/auth/2fa/verify-setup/route.ts
//
// POST /api/auth/2fa/verify-setup
//   body: { code: string }
//   pending 상태 secret 에 대해 첫 코드 검증. 통과 시 enabled.

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  getAuthenticatedSessionContext,
} from "@/lib/server/accountAuth";
import { verifyTotp } from "@/lib/server/totp";
import {
  getUserTotp,
  markTotpEnabled,
  recordTotpFailure,
  isLockedNow,
} from "@/lib/server/userTotpDb";
import { safeAppendAccess } from "@/lib/server/auditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const ctx = await getAuthenticatedSessionContext(token);
  if (!ctx) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) {
    return NextResponse.json({ ok: false, error: "missing_code" }, { status: 400 });
  }

  try {
    const totp = await getUserTotp(ctx.userId);
    if (!totp) {
      return NextResponse.json(
        { ok: false, error: "no_pending_secret" },
        { status: 404 },
      );
    }
    if (totp.enabledAt) {
      return NextResponse.json(
        { ok: false, error: "already_enabled" },
        { status: 409 },
      );
    }
    if (isLockedNow(totp)) {
      return NextResponse.json(
        { ok: false, error: "locked_too_many_failures" },
        { status: 429 },
      );
    }

    const verified = verifyTotp({
      secretBase32: totp.secretBase32,
      code,
      digits: totp.digits,
      periodSec: totp.periodSec,
      algorithm: totp.algorithm,
    });

    if (verified === null) {
      await recordTotpFailure(ctx.userId);
      await safeAppendAccess({
        request: req,
        action: "update",
        status: "failed",
        operatorUserId: ctx.userId,
        operatorUserRole: ctx.userRole,
        subjectUserId: ctx.userId,
        resourceType: "user_2fa_totp",
        resourceId: ctx.userId,
        httpStatus: 401,
        failureReason: "invalid_totp_code",
      });
      return NextResponse.json(
        { ok: false, error: "invalid_code" },
        { status: 401 },
      );
    }

    await markTotpEnabled(ctx.userId);
    await safeAppendAccess({
      request: req,
      action: "update",
      operatorUserId: ctx.userId,
      operatorUserRole: ctx.userRole,
      subjectUserId: ctx.userId,
      resourceType: "user_2fa_totp",
      resourceId: ctx.userId,
      httpStatus: 200,
    });
    return NextResponse.json({ ok: true, enabled: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "verify_failed";
    console.error("[2fa/verify-setup][POST]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
