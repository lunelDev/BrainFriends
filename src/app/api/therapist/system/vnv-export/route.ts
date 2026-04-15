import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, getAuthenticatedSessionContext } from "@/lib/server/accountAuth";
import { buildVnvEvidenceSummary } from "@/lib/server/vnvEvidenceDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function canAccessTherapistConsole(role: string | null | undefined) {
  return role === "admin" || role === "therapist";
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const context = await getAuthenticatedSessionContext(token);
  if (!context) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!canAccessTherapistConsole(context.userRole)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const summary = await buildVnvEvidenceSummary(token);
  return new NextResponse(JSON.stringify(summary, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="brainfriends-vnv-evidence-report.json"',
    },
  });
}
