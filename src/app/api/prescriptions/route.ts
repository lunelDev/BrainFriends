// src/app/api/prescriptions/route.ts
//
// POST /api/prescriptions  — 처방 생성 (prescriber / admin 만)
// GET  /api/prescriptions  — 처방자(prescriber/admin) 본인이 발행한 처방 목록
//
// 환자 본인 조회는 /api/prescriptions/me 에서 분리 처리.

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  getAuthenticatedSessionContext,
} from "@/lib/server/accountAuth";
import {
  createPrescription,
  listPrescriptionsByPrescriber,
} from "@/lib/server/prescriptionsDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAllowedPrescriber(role: string) {
  return role === "prescriber" || role === "admin";
}

function parseProgramScope(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const cleaned = raw
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
  return cleaned.length ? cleaned : null;
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const ctx = await getAuthenticatedSessionContext(token);
  if (!ctx || !isAllowedPrescriber(ctx.userRole)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  try {
    const rows = await listPrescriptionsByPrescriber(ctx.userId);
    return NextResponse.json({ ok: true, prescriptions: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "list_failed";
    console.error("[prescriptions][GET]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const ctx = await getAuthenticatedSessionContext(token);
  if (!ctx || !isAllowedPrescriber(ctx.userRole)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const patientUserId =
    typeof body.patientUserId === "string" ? body.patientUserId.trim() : "";
  const patientPseudonymId =
    typeof body.patientPseudonymId === "string"
      ? body.patientPseudonymId.trim()
      : "";
  const programScope = parseProgramScope(body.programScope);
  const durationWeeks = Number(body.durationWeeks);
  const sessionsPerWeek = Number(body.sessionsPerWeek);
  const sessionMinutes = Number(body.sessionMinutes);

  if (!patientUserId || !patientPseudonymId) {
    return NextResponse.json(
      { ok: false, error: "missing_patient_identifiers" },
      { status: 400 },
    );
  }
  if (!programScope) {
    return NextResponse.json(
      { ok: false, error: "invalid_program_scope" },
      { status: 400 },
    );
  }
  if (
    !Number.isFinite(durationWeeks) ||
    !Number.isFinite(sessionsPerWeek) ||
    !Number.isFinite(sessionMinutes)
  ) {
    return NextResponse.json(
      { ok: false, error: "invalid_dosing" },
      { status: 400 },
    );
  }

  try {
    const row = await createPrescription({
      patientUserId,
      patientPseudonymId,
      prescriberUserId: ctx.userId,
      programScope,
      durationWeeks,
      sessionsPerWeek,
      sessionMinutes,
    });
    return NextResponse.json({ ok: true, prescription: row });
  } catch (err) {
    const message = err instanceof Error ? err.message : "create_failed";
    console.error("[prescriptions][POST]", message);
    const status =
      message.startsWith("invalid_") || message === "empty_program_scope"
        ? 400
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
