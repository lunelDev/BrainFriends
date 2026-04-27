// src/app/api/adverse-events/me/route.ts
//
// GET /api/adverse-events/me
//   환자 본인이 자신이 신고한 AE 이력 조회.

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  getAuthenticatedSessionContext,
} from "@/lib/server/accountAuth";
import { listAdverseEventsForPatient } from "@/lib/server/adverseEventsDb";
import { safeAppendAccess } from "@/lib/server/auditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
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
    const events = await listAdverseEventsForPatient(ctx.userId);
    await safeAppendAccess({
      request: req,
      action: "list",
      operatorUserId: ctx.userId,
      operatorUserRole: ctx.userRole,
      subjectUserId: ctx.userId,
      subjectPseudonymId: ctx.patientPseudonymId,
      resourceType: "adverse_event",
      httpStatus: 200,
    });
    return NextResponse.json({ ok: true, events });
  } catch (err) {
    const message = err instanceof Error ? err.message : "me_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
