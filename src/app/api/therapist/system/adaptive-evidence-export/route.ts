import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, getAuthenticatedSessionContext } from "@/lib/server/accountAuth";
import { buildAdaptiveEvidenceExport } from "@/lib/server/adaptiveEvidenceExportDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function canAccessTherapistConsole(role: string | null | undefined) {
  return role === "admin" || role === "therapist";
}

function csvResponse(body: string, filename: string) {
  return new NextResponse(`\uFEFF${body}`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest) {
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

  const report = await buildAdaptiveEvidenceExport();
  const format = request.nextUrl.searchParams.get("format");
  if (format === "csv") {
    return csvResponse(
      report.csv.adaptiveEvidenceCsv,
      "brainfriends-adaptive-irt-evidence.csv",
    );
  }
  if (format === "item-summary-csv") {
    return csvResponse(
      report.csv.itemSummaryCsv,
      "brainfriends-adaptive-irt-item-summary.csv",
    );
  }
  if (format === "session-summary-csv") {
    return csvResponse(
      report.csv.sessionSummaryCsv,
      "brainfriends-adaptive-irt-session-summary.csv",
    );
  }

  return new NextResponse(JSON.stringify(report, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="brainfriends-adaptive-irt-evidence.json"',
      "Cache-Control": "no-store",
    },
  });
}
