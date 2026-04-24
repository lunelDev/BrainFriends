import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/server/accountAuth";
import { getDetailByHistoryIdForAuthenticatedUser } from "@/lib/server/historyQueries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Next.js 16 (App Router): dynamic route segment 의 params 는 Promise 로 전달된다.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ historyId: string }> },
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { historyId } = await params;
  const normalized = String(historyId || "").trim();
  if (!normalized) {
    return NextResponse.json({ ok: false, error: "invalid_history_id" }, { status: 400 });
  }

  try {
    const entry = await getDetailByHistoryIdForAuthenticatedUser(token, normalized);
    if (!entry) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, entry });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed_to_load_history_detail";
    const status = message === "unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
