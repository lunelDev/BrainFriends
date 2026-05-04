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
import { safeAppendAccess } from "@/lib/server/auditLog";
import {
  PrescriptionRedeemInputSchema,
  validateInput,
} from "@/lib/server/inputSchemas";

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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  // SI-05: zod 통합 스키마로 검증.
  const parsed = validateInput(PrescriptionRedeemInputSchema, body);
  if (!parsed.ok || !parsed.data) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload" },
      { status: 400 },
    );
  }
  const code = parsed.data.code;

  try {
    const rx = await redeemPrescription({ code, patientUserId: ctx.userId });
    await safeAppendAccess({
      request: req,
      action: "redeem",
      operatorUserId: ctx.userId,
      operatorUserRole: ctx.userRole,
      subjectUserId: rx.patientUserId,
      subjectPseudonymId: rx.patientPseudonymId,
      resourceType: "prescription",
      resourceId: rx.id,
      httpStatus: 200,
    });
    return NextResponse.json({ ok: true, prescription: rx });
  } catch (err) {
    const message = err instanceof Error ? err.message : "redeem_failed";
    console.error("[prescriptions/redeem][POST]", message);
    let status = 500;
    if (message === "prescription_not_found") status = 404;
    else if (message === "prescription_owner_mismatch") status = 403;
    else if (message.startsWith("prescription_")) status = 400;
    await safeAppendAccess({
      request: req,
      action: "redeem",
      status: "failed",
      operatorUserId: ctx.userId,
      operatorUserRole: ctx.userRole,
      resourceType: "prescription",
      httpStatus: status,
      failureReason: message,
    });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
