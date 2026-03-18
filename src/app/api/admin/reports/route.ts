import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, getAuthenticatedSessionContext } from "@/lib/server/accountAuth";
import {
  getAdminPatientReportDetail,
  listAdminReportValidationSample,
  listAdminPatientReportSummaries,
} from "@/lib/server/adminReportsDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patientId");

  try {
    const context = await getAuthenticatedSessionContext(token);
    if (!context || context.userRole !== "admin") {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    if (patientId) {
      const result = await getAdminPatientReportDetail(token, patientId);
      return NextResponse.json({ ok: true, ...result });
    }

    const [patients, validationSampleEntries] = await Promise.all([
      listAdminPatientReportSummaries(token),
      listAdminReportValidationSample(token),
    ]);
    return NextResponse.json({ ok: true, patients, validationSampleEntries });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed_to_load_admin_reports";
    const status =
      message === "unauthorized"
        ? 401
        : message === "patient_not_found"
          ? 404
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
