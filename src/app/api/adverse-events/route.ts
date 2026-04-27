// src/app/api/adverse-events/route.ts
//
// POST /api/adverse-events — 환자 또는 처방자 신고 등록
// GET  /api/adverse-events — 처방자가 본인 환자들의 AE 목록 조회

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  getAuthenticatedSessionContext,
} from "@/lib/server/accountAuth";
import {
  AE_CATEGORIES,
  createAdverseEvent,
  listAdverseEventsForPrescriber,
  type AdverseEventCategory,
  type AdverseEventReporterRole,
} from "@/lib/server/adverseEventsDb";
import { getActivePrescriptionForPatient } from "@/lib/server/prescriptionsDb";
import { safeAppendAccess } from "@/lib/server/auditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidCategory(v: unknown): v is AdverseEventCategory {
  return typeof v === "string" && (AE_CATEGORIES as string[]).includes(v);
}
function isValidSeverity(v: unknown): v is 1 | 2 | 3 {
  return v === 1 || v === 2 || v === 3;
}

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const ctx = await getAuthenticatedSessionContext(token);
  if (!ctx || (ctx.userRole !== "prescriber" && ctx.userRole !== "admin")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const onlyUnack = searchParams.get("onlyUnacknowledgedSevere") === "1";

  try {
    const rows = await listAdverseEventsForPrescriber(ctx.userId, {
      onlyUnacknowledgedSevere: onlyUnack,
    });
    await safeAppendAccess({
      request: req,
      action: "list",
      operatorUserId: ctx.userId,
      operatorUserRole: ctx.userRole,
      resourceType: "adverse_event",
      httpStatus: 200,
    });
    return NextResponse.json({ ok: true, events: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "list_failed";
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
  if (!ctx) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const category = body.category;
  const severityRaw = Number(body.severity);
  const severity =
    Number.isFinite(severityRaw) && severityRaw >= 1 && severityRaw <= 3
      ? (Math.floor(severityRaw) as 1 | 2 | 3)
      : null;
  const freeText =
    typeof body.freeText === "string" ? body.freeText.trim() : null;

  if (!isValidCategory(category)) {
    return NextResponse.json(
      { ok: false, error: "invalid_category" },
      { status: 400 },
    );
  }
  if (!severity || !isValidSeverity(severity)) {
    return NextResponse.json(
      { ok: false, error: "invalid_severity" },
      { status: 400 },
    );
  }

  // 신고자/대상 환자 결정
  // 환자 본인 신고 vs 처방자가 환자 대신 신고
  let patientUserId = ctx.userId;
  let patientPseudonymId = ctx.patientPseudonymId;
  let reporterRole: AdverseEventReporterRole = "patient";

  if (ctx.userRole === "prescriber" || ctx.userRole === "admin") {
    const targetPatientUserId =
      typeof body.patientUserId === "string" ? body.patientUserId.trim() : "";
    const targetPatientPseudonymId =
      typeof body.patientPseudonymId === "string"
        ? body.patientPseudonymId.trim()
        : "";
    if (!targetPatientUserId || !targetPatientPseudonymId) {
      return NextResponse.json(
        { ok: false, error: "missing_patient_identifiers" },
        { status: 400 },
      );
    }
    patientUserId = targetPatientUserId;
    patientPseudonymId = targetPatientPseudonymId;
    reporterRole = ctx.userRole === "admin" ? "admin" : "prescriber";
  } else if (ctx.userRole === "therapist") {
    // 치료사 대신 신고는 현재 비허용 — 환자 본인 또는 의사만
    return NextResponse.json(
      { ok: false, error: "therapist_self_report_not_allowed" },
      { status: 403 },
    );
  }

  let prescriptionId: string | null = null;
  try {
    if (reporterRole === "patient") {
      const rx = await getActivePrescriptionForPatient(patientUserId);
      prescriptionId = rx?.id ?? null;
    } else if (typeof body.prescriptionId === "string" && body.prescriptionId.trim()) {
      prescriptionId = body.prescriptionId.trim();
    }
  } catch {
    /* 처방 조회 실패해도 AE 등록은 진행 */
  }

  try {
    const row = await createAdverseEvent({
      patientUserId,
      patientPseudonymId,
      prescriptionId,
      reporterUserId: ctx.userId,
      reporterRole,
      category,
      severity,
      freeText: freeText || null,
    });
    await safeAppendAccess({
      request: req,
      action: "create",
      operatorUserId: ctx.userId,
      operatorUserRole: ctx.userRole,
      subjectUserId: patientUserId,
      subjectPseudonymId: patientPseudonymId,
      resourceType: "adverse_event",
      resourceId: row.id,
      httpStatus: 200,
    });
    return NextResponse.json({ ok: true, event: row });
  } catch (err) {
    const message = err instanceof Error ? err.message : "create_failed";
    console.error("[adverse-events][POST]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
