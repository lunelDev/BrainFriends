// src/app/api/prescriptions/[id]/sessions/route.ts
//
// POST /api/prescriptions/[id]/sessions
//   환자가 학습 세션을 완료했을 때 adherence 레코드 1건 기록.
//   body: { programCode, trainingResultId?, durationSec?, startedAt?, completedAt? }
//
// 이 라우트는 학습 결과 저장 자체와 독립적으로 호출되어도 되고,
// 서버측 clinicalResultsDb 저장 훅에서 같이 호출되어도 된다.

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  getAuthenticatedSessionContext,
} from "@/lib/server/accountAuth";
import { getPrescriptionById } from "@/lib/server/prescriptionsDb";
import { recordSession } from "@/lib/server/prescriptionSessionsDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: prescriptionId } = await params;
  if (!prescriptionId) {
    return NextResponse.json(
      { ok: false, error: "missing_prescription_id" },
      { status: 400 },
    );
  }

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

  const programCode =
    typeof body.programCode === "string" ? body.programCode.trim() : "";
  if (!programCode) {
    return NextResponse.json(
      { ok: false, error: "missing_program_code" },
      { status: 400 },
    );
  }

  try {
    const rx = await getPrescriptionById(prescriptionId);
    if (!rx) {
      return NextResponse.json(
        { ok: false, error: "prescription_not_found" },
        { status: 404 },
      );
    }
    // 환자 본인만 자기 처방에 adherence 기록 가능. admin 은 테스트 용도로 허용.
    if (ctx.userRole !== "admin" && rx.patientUserId !== ctx.userId) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    if (rx.status !== "active") {
      return NextResponse.json(
        { ok: false, error: `prescription_${rx.status}` },
        { status: 400 },
      );
    }

    const durationSecRaw = body.durationSec;
    const trainingResultId =
      typeof body.trainingResultId === "string" && body.trainingResultId.trim()
        ? body.trainingResultId.trim()
        : null;

    const session = await recordSession({
      prescriptionId: rx.id,
      prescriptionStartsAt: rx.startsAt,
      programCode,
      trainingResultId,
      startedAt: parseDate(body.startedAt) ?? undefined,
      completedAt: parseDate(body.completedAt) ?? new Date(),
      durationSec:
        typeof durationSecRaw === "number" && Number.isFinite(durationSecRaw)
          ? Math.max(0, Math.floor(durationSecRaw))
          : null,
      completed: true,
    });
    return NextResponse.json({ ok: true, session });
  } catch (err) {
    const message = err instanceof Error ? err.message : "record_failed";
    console.error("[prescriptions/sessions][POST]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
