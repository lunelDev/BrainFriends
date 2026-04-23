import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  getAuthenticatedSessionContext,
} from "@/lib/server/accountAuth";
import { listTherapistPatientNotesScoped } from "@/lib/server/therapistReportsDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function canAccessTherapistConsole(role: string | null | undefined) {
  return role === "admin" || role === "therapist";
}

/**
 * 현재 세션이 접근 가능한 환자의 메모/follow-up 묶음을 반환한다.
 * - admin: 전체 노트
 * - therapist: 본인 담당 환자 노트만
 * 일반 사용자는 403.
 */
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const context = await getAuthenticatedSessionContext(token);
    if (!context) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    if (!canAccessTherapistConsole(context.userRole)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const notes = await listTherapistPatientNotesScoped(token);
    return NextResponse.json({ ok: true, notes });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed_to_load_therapist_notes";
    const status =
      message === "unauthorized" ? 401 : message === "forbidden" ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
