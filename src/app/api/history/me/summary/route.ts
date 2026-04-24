import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/server/accountAuth";
import {
  listSummaryForAuthenticatedUser,
  type HistoryListMode,
} from "@/lib/server/historyQueries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseMode(raw: string | null): HistoryListMode {
  if (raw === "self" || raw === "rehab" || raw === "sing" || raw === "all") {
    return raw;
  }
  return "all";
}

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const mode = parseMode(url.searchParams.get("mode"));
  const limitRaw = url.searchParams.get("limit");
  const cursor = url.searchParams.get("cursor") || undefined;
  const limit = limitRaw != null ? Number(limitRaw) : undefined;

  try {
    const { items, nextCursor } = await listSummaryForAuthenticatedUser(token, {
      mode,
      limit,
      cursor,
    });
    return NextResponse.json({ ok: true, items, nextCursor });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed_to_load_history_summary";
    const status = message === "unauthorized" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
