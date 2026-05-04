import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  getAuthenticatedSessionContext,
} from "@/lib/server/accountAuth";
import {
  listGuardianContacts,
  revokeGuardianContactConsent,
  upsertGuardianContact,
} from "@/lib/server/guardianContactsDb";
import { canTherapistAccessPatient } from "@/lib/server/therapistReportsDb";
import {
  GuardianContactInputSchema,
  GuardianContactRevokeInputSchema,
  validateInput,
} from "@/lib/server/inputSchemas";
import { safeAppendAccess } from "@/lib/server/auditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getContext() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  const context = await getAuthenticatedSessionContext(token);
  if (!context) return null;
  return { token, context };
}

async function canAccessPatient(token: string, context: Awaited<ReturnType<typeof getAuthenticatedSessionContext>>, patientId: string) {
  if (!context) return false;
  if (context.userRole === "admin") return true;
  if (context.userRole === "patient" && context.patientId === patientId) return true;
  if (context.userRole === "therapist") return canTherapistAccessPatient(token, patientId);
  return false;
}

export async function GET(req: Request) {
  const auth = await getContext();
  if (!auth) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const patientId = String(url.searchParams.get("patientId") ?? "").trim();
  if (!patientId) {
    return NextResponse.json({ ok: false, error: "missing_patient_id" }, { status: 400 });
  }
  if (!(await canAccessPatient(auth.token, auth.context, patientId))) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const contacts = await listGuardianContacts(patientId);
  return NextResponse.json({ ok: true, contacts });
}

export async function POST(req: Request) {
  const auth = await getContext();
  if (!auth) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = validateInput(GuardianContactInputSchema, body);
  if (!parsed.ok || !parsed.data) {
    return NextResponse.json({ ok: false, error: parsed.publicError }, { status: 400 });
  }
  if (!(await canAccessPatient(auth.token, auth.context, parsed.data.patientId))) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  try {
    const contact = await upsertGuardianContact({
      ...parsed.data,
      createdByUserId: auth.context.userId,
    });
    await safeAppendAccess({
      request: req,
      action: "create",
      status: "success",
      operatorUserId: auth.context.userId,
      operatorUserRole: auth.context.userRole,
      subjectUserId: contact.patientId,
      subjectPseudonymId: contact.patientPseudonymId,
      resourceType: "guardian_contact",
      resourceId: contact.id,
      httpStatus: 200,
    });
    return NextResponse.json({ ok: true, contact });
  } catch (error) {
    const message = error instanceof Error ? error.message : "guardian_contact_failed";
    return NextResponse.json(
      { ok: false, error: message },
      { status: message === "patient_not_found" ? 404 : 500 },
    );
  }
}

export async function DELETE(req: Request) {
  const auth = await getContext();
  if (!auth) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = validateInput(GuardianContactRevokeInputSchema, body);
  if (!parsed.ok || !parsed.data) {
    return NextResponse.json({ ok: false, error: parsed.publicError }, { status: 400 });
  }
  if (!(await canAccessPatient(auth.token, auth.context, parsed.data.patientId))) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  try {
    const contact = await revokeGuardianContactConsent(parsed.data);
    await safeAppendAccess({
      request: req,
      action: "revoke",
      status: "success",
      operatorUserId: auth.context.userId,
      operatorUserRole: auth.context.userRole,
      subjectUserId: contact.patientId,
      subjectPseudonymId: contact.patientPseudonymId,
      resourceType: "guardian_contact",
      resourceId: contact.id,
      httpStatus: 200,
    });
    return NextResponse.json({ ok: true, contact });
  } catch (error) {
    const message = error instanceof Error ? error.message : "guardian_contact_revoke_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 404 });
  }
}
