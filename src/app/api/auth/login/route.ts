import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  authenticateAccount,
  getAuthenticatedSessionContext,
  invalidateSession,
} from "@/lib/server/accountAuth";
import { getUserTotp, recordTotpFailure, recordTotpVerified, isLockedNow } from "@/lib/server/userTotpDb";
import { verifyTotp } from "@/lib/server/totp";
import { LoginInputSchema, validateInput } from "@/lib/server/inputSchemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TOTP 가 enabled 인 사용자(처방자/관리자 등) 는 ID/PW 통과 후
// 추가로 6자리 TOTP 코드를 동일 요청 body 에 함께 보내야 한다.
// 누락 시 세션을 즉시 무효화하고 totp_required 로 응답해 클라이언트가
// 1단계 → 2단계 흐름을 안내하도록 한다.
export async function POST(req: Request) {
  const isSecureRequest = new URL(req.url).protocol === "https:";
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { ok: false, error: "invalid_login_payload" },
      { status: 400 },
    );
  }

  // SI-05: zod 통합 스키마로 검증.
  const parsed = validateInput(LoginInputSchema, body);
  if (!parsed.ok || !parsed.data) {
    return NextResponse.json(
      { ok: false, error: "invalid_login_payload" },
      { status: 400 },
    );
  }

  const totpCode =
    typeof body.totpCode === "string" ? body.totpCode.trim() : "";

  try {
    const authenticated = await authenticateAccount({
      loginId: parsed.data.loginId,
      password: parsed.data.password,
    });

    // TOTP 강제 여부 결정. 현재 정책:
    //   - user_2fa_totp 행이 존재하고 enabled_at 이 채워져 있으면 강제.
    //   - 추가로 prescriber/admin 은 향후 행이 없어도 강제하도록 확장 가능.
    const ctx = await getAuthenticatedSessionContext(authenticated.sessionToken);
    const totp = ctx ? await getUserTotp(ctx.userId) : null;
    const totpRequired = Boolean(totp && totp.enabledAt);

    if (totpRequired) {
      if (!totpCode) {
        // 세션 발급 취소 — 2단계 인증 완료 전엔 어떤 보호 자원도 접근 불가
        await invalidateSession(authenticated.sessionToken);
        return NextResponse.json(
          { ok: false, error: "totp_required" },
          { status: 401 },
        );
      }

      if (totp && isLockedNow(totp)) {
        await invalidateSession(authenticated.sessionToken);
        return NextResponse.json(
          { ok: false, error: "locked_too_many_failures" },
          { status: 429 },
        );
      }

      const verified =
        totp &&
        verifyTotp({
          secretBase32: totp.secretBase32,
          code: totpCode,
          digits: totp.digits,
          periodSec: totp.periodSec,
          algorithm: totp.algorithm,
        });
      if (verified === null || verified === undefined) {
        if (ctx) await recordTotpFailure(ctx.userId);
        await invalidateSession(authenticated.sessionToken);
        return NextResponse.json(
          { ok: false, error: "invalid_totp_code" },
          { status: 401 },
        );
      }

      if (ctx) await recordTotpVerified(ctx.userId);
    }

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
          : message === "approval_pending"
            ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
