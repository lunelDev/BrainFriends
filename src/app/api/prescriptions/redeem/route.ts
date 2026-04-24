// src/app/api/prescriptions/redeem/route.ts
//
// POST /api/prescriptions/redeem
//   body: { code: string }
//   환자가 처방 코드를 입력해서 status='active' 로 전환.
//   코드 소유자(patient_user_id) 불일치면 403.

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  getAuthenticatedSessionContext,
} from "@/lib/server/accountAuth";
import { redeemPrescription } from "@/lib/server/prescriptionsDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const ctx = await getAuthenticatedSessionContext(token);
  if (!ctx || ctx.userRole !== "patient") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) {
    return NextResponse.json(
      { ok: false, error: "missing_code" },
      { status: 400 },
    );
  }

  try {
    const rx = await redeemPrescription({ code, patientUserId: ctx.userId });
    return NextResponse.json({ ok: true, prescription: rx });
  } catch (err) {
    const message = err instanceof Error ? err.message : "redeem_failed";
    console.error("[prescriptions/redeem][POST]", message);
    let status = 500;
    if (message === "prescription_not_found") status = 404;
    else if (message === "prescription_owner_mismatch") status = 403;
    else if (message.startsWith("prescription_")) status = 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
