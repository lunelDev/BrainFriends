import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  getAuthenticatedSessionContext,
} from "@/lib/server/accountAuth";
import {
  createGuardianReportLink,
  getGuardianReportLinkAccessMetadata,
  revokeGuardianReportLink,
} from "@/lib/server/guardianReportsDb";
import { canTherapistAccessPatient } from "@/lib/server/therapistReportsDb";
import { safeAppendAccess } from "@/lib/server/auditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildAbsoluteUrl(req: Request, path: string) {
  const url = new URL(req.url);
  return `${url.origin}${path}`;
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const context = await getAuthenticatedSessionContext(token);
  if (!context) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const patientId = String(body?.patientId ?? "").trim();
  const recipientLabel = String(body?.recipientLabel ?? "").trim();
  const ttlDaysRaw = Number(body?.ttlDays ?? 14);
  const ttlDays = Number.isFinite(ttlDaysRaw) ? ttlDaysRaw : 14;

  if (!patientId) {
    return NextResponse.json({ ok: false, error: "missing_patient_id" }, { status: 400 });
  }

  const isSelfPatient = context.userRole === "patient" && context.patientId === patientId;
  const isCareTeam =
    context.userRole === "admin" ||
    (context.userRole === "therapist" &&
      (await canTherapistAccessPatient(token, patientId)));

  if (!isSelfPatient && !isCareTeam) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  try {
    const link = await createGuardianReportLink({
      patientId,
      createdByUserId: context.userId,
      recipientLabel: recipientLabel || null,
      ttlDays,
    });
    await safeAppendAccess({
      request: req,
      action: "create",
      status: "success",
      operatorUserId: context.userId,
      operatorUserRole: context.userRole,
      subjectUserId: link.patientId,
      subjectPseudonymId: link.patientPseudonymId,
      resourceType: "guardian_report_link",
      resourceId: link.id,
      httpStatus: 200,
    });
    return NextResponse.json({
      ok: true,
      link: {
        ...link,
        url: buildAbsoluteUrl(req, link.urlPath),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "guardian_report_link_failed";
    const status =
      message === "patient_not_found"
        ? 404
        : message === "guardian_consent_required"
          ? 409
          : 500;
    await safeAppendAccess({
      request: req,
      action: "create",
      status: "failed",
      operatorUserId: context.userId,
      operatorUserRole: context.userRole,
      subjectUserId: patientId || null,
      resourceType: "guardian_report_link",
      httpStatus: status,
      failureReason: message,
    });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const context = await getAuthenticatedSessionContext(token);
  if (!context) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (context.userRole !== "admin" && context.userRole !== "therapist") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const linkId = String(body?.linkId ?? "").trim();
  if (!linkId) {
    return NextResponse.json({ ok: false, error: "missing_link_id" }, { status: 400 });
  }

  const metadata = await getGuardianReportLinkAccessMetadata(linkId);
  if (!metadata) {
    await safeAppendAccess({
      request: req,
      action: "revoke",
      status: "failed",
      operatorUserId: context.userId,
      operatorUserRole: context.userRole,
      resourceType: "guardian_report_link",
      resourceId: linkId,
      httpStatus: 404,
      failureReason: "guardian_report_link_not_found",
    });
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const canRevoke =
    context.userRole === "admin" ||
    (context.userRole === "therapist" &&
      (await canTherapistAccessPatient(token, metadata.patientId)));
  if (!canRevoke) {
    await safeAppendAccess({
      request: req,
      action: "revoke",
      status: "rejected",
      operatorUserId: context.userId,
      operatorUserRole: context.userRole,
      subjectUserId: metadata.patientId,
      subjectPseudonymId: metadata.patientPseudonymId,
      resourceType: "guardian_report_link",
      resourceId: linkId,
      httpStatus: 403,
      failureReason: "forbidden_patient_scope",
    });
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const result = await revokeGuardianReportLink({
    linkId,
    revokedByUserId: context.userId,
    reason: "manual_revoke",
  });
  await safeAppendAccess({
    request: req,
    action: "revoke",
    status: "success",
    operatorUserId: context.userId,
    operatorUserRole: context.userRole,
    subjectUserId: result.patientId,
    subjectPseudonymId: result.patientPseudonymId,
    resourceType: "guardian_report_link",
    resourceId: result.linkId,
    httpStatus: 200,
  });
  return NextResponse.json({ ok: true, linkId: result.linkId });
}
