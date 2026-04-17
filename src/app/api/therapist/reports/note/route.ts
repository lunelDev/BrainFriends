import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  getAuthenticatedSessionContext,
} from "@/lib/server/accountAuth";
import {
  getTherapistPatientNote,
  saveTherapistPatientNote,
  type TherapistFollowUpState,
} from "@/lib/server/therapistNotes";
import { canTherapistAccessPatient } from "@/lib/server/therapistReportsDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function canAccessTherapistConsole(role: string | null | undefined) {
  return role === "admin" || role === "therapist";
}

function normalizeFollowUpState(value: unknown): TherapistFollowUpState {
  if (
    value === "monitor" ||
    value === "follow_up" ||
    value === "priority" ||
    value === "none"
  ) {
    return value;
  }
  return "none";
}

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const patientId = String(searchParams.get("patientId") ?? "").trim();
  if (!patientId) {
    return NextResponse.json({ ok: false, error: "missing_patient_id" }, { status: 400 });
  }

  try {
    const context = await getAuthenticatedSessionContext(token);
    if (!context) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    if (!canAccessTherapistConsole(context.userRole)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    if (!(await canTherapistAccessPatient(token, patientId))) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const note = await getTherapistPatientNote(patientId);
    return NextResponse.json({ ok: true, note });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed_to_load_therapist_note";
    const status =
      message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const patientId = String(body?.patientId ?? "").trim();
  const memo = String(body?.memo ?? "");
  const followUpState = normalizeFollowUpState(body?.followUpState);
  if (!patientId) {
    return NextResponse.json({ ok: false, error: "missing_patient_id" }, { status: 400 });
  }

  try {
    const context = await getAuthenticatedSessionContext(token);
    if (!context) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    if (!canAccessTherapistConsole(context.userRole)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    if (!(await canTherapistAccessPatient(token, patientId))) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const note = await saveTherapistPatientNote({
      patientId,
      memo,
      followUpState,
      updatedBy: context.patient.name || context.userId || "therapist",
    });
    return NextResponse.json({ ok: true, note });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed_to_save_therapist_note";
    const status =
      message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
