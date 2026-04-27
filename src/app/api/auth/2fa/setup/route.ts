// src/app/api/auth/2fa/setup/route.ts
//
// POST /api/auth/2fa/setup
//   처방자/관리자 본인이 새 TOTP secret 발급. 응답: secret + otpauth URI.
//   activate 는 별도(/verify-setup) — 첫 코드 검증을 통과해야 enabled.
//
// 정책:
//   - 환자/치료사도 본인 의지로 등록 가능 (옵션). 강제는 아님.
//   - 이미 enabled 상태면 거부 (먼저 disable 해야 함).
//   - pending 상태면 새 secret 으로 덮어쓰기 (중간에 단말 바꾼 경우).

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  getAuthenticatedSessionContext,
} from "@/lib/server/accountAuth";
import {
  generateTotpSecretBase32,
  buildOtpAuthUri,
} from "@/lib/server/totp";
import {
  getUserTotp,
  upsertPendingTotpSecret,
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

  try {
    const existing = await getUserTotp(ctx.userId);
    if (existing && existing.enabledAt) {
      return NextResponse.json(
        { ok: false, error: "already_enabled" },
        { status: 409 },
      );
    }

    const secret = generateTotpSecretBase32(20);
    await upsertPendingTotpSecret({
      userId: ctx.userId,
      secretBase32: secret,
    });

    // 사용자 식별용 account 라벨 — 가능한 한 PII 비노출.
    // user_id 일부 + role 조합으로 인증앱 화면에서 본인 항목 구분 가능하게.
    const account = `${ctx.userRole}-${ctx.userId.slice(0, 8)}`;
    const otpauth = buildOtpAuthUri({
      secretBase32: secret,
      account,
      issuer: "BrainFriends",
    });

    await safeAppendAccess({
      request: req,
      action: "create",
      operatorUserId: ctx.userId,
      operatorUserRole: ctx.userRole,
      subjectUserId: ctx.userId,
      resourceType: "user_2fa_totp",
      resourceId: ctx.userId,
      httpStatus: 200,
    });

    return NextResponse.json({
      ok: true,
      secret,
      otpauth,
      hint:
        "인증앱(Google/Microsoft Authenticator 등)에 위 secret 을 등록하고, 6자리 코드를 /api/auth/2fa/verify-setup 으로 보내 활성화하세요.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "setup_failed";
    console.error("[2fa/setup][POST]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
