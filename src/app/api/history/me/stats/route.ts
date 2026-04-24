import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/server/accountAuth";
import { getStatsForAuthenticatedUser } from "@/lib/server/historyQueries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const stats = await getStatsForAuthenticatedUser(token);
    return NextResponse.json({ ok: true, stats });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed_to_load_history_stats";
    const status = message === "unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
