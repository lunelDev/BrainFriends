// src/app/api/prescriptions/me/route.ts
//
// GET /api/prescriptions/me
//   환자 본인의 활성 처방 1건 + 주간 순응도.
//   처방 없으면 { ok: true, prescription: null } 반환 (에러 아님).

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  getAuthenticatedSessionContext,
} from "@/lib/server/accountAuth";
import { getActivePrescriptionForPatient } from "@/lib/server/prescriptionsDb";
import { getCurrentWeekAdherence } from "@/lib/server/prescriptionSessionsDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
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
    const rx = await getActivePrescriptionForPatient(ctx.userId);
    if (!rx) {
      return NextResponse.json({ ok: true, prescription: null, adherence: null });
    }

    const adherence = await getCurrentWeekAdherence({
      prescriptionId: rx.id,
      sessionsPerWeek: rx.sessionsPerWeek,
      prescriptionStartsAt: rx.startsAt,
    });

    const now = Date.now();
    const remainingDays = Math.max(
      0,
      Math.ceil((rx.expiresAt.getTime() - now) / (24 * 60 * 60 * 1000)),
    );

    return NextResponse.json({
      ok: true,
      prescription: rx,
      adherence,
      remainingDays,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "me_failed";
    console.error("[prescriptions/me][GET]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
