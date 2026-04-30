import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  getAuthenticatedSessionContext,
} from "@/lib/server/accountAuth";
import {
  createGuardianReportLink,
  listGuardianWeeklyReportCandidates,
} from "@/lib/server/guardianReportsDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildAbsoluteUrl(req: Request, path: string) {
  const url = new URL(req.url);
  return `${url.origin}${path}`;
}

async function resolveOperator(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return {
      userId: null,
      userRole: "admin" as const,
    };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  const context = await getAuthenticatedSessionContext(token);
  if (!context || (context.userRole !== "admin" && context.userRole !== "therapist")) {
    return null;
  }
  return {
    userId: context.userId,
    userRole: context.userRole,
  };
}

export async function GET(req: Request) {
  const operator = await resolveOperator(req);
  if (!operator) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const candidates = await listGuardianWeeklyReportCandidates({
    createdByUserId: operator.userId ?? "00000000-0000-0000-0000-000000000000",
    userRole: operator.userRole,
  });
  return NextResponse.json({
    ok: true,
    mode: "preview",
    delivery: "not_sent",
    candidates,
  });
}

export async function POST(req: Request) {
  const operator = await resolveOperator(req);
  if (!operator) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const patientIds = Array.isArray(body?.patientIds)
    ? body.patientIds.map((value: unknown) => String(value).trim()).filter(Boolean)
    : undefined;
  const ttlDaysRaw = Number(body?.ttlDays ?? 14);
  const ttlDays = Number.isFinite(ttlDaysRaw) ? ttlDaysRaw : 14;

  const candidates = await listGuardianWeeklyReportCandidates({
    createdByUserId: operator.userId ?? "00000000-0000-0000-0000-000000000000",
    userRole: operator.userRole,
    patientIds,
  });
  const links = await Promise.all(
    candidates.map((candidate) =>
      createGuardianReportLink({
        patientId: candidate.patientId,
        createdByUserId: operator.userId,
        recipientLabel: "주간 보호자 리포트",
        ttlDays,
      }).then((link) => ({
        patientId: candidate.patientId,
        maskedName: candidate.maskedName,
        latestCompletedAt: candidate.latestCompletedAt,
        url: buildAbsoluteUrl(req, link.urlPath),
        expiresAt: link.expiresAt,
      })),
    ),
  );

  return NextResponse.json({
    ok: true,
    mode: "link_generation",
    delivery: "not_sent",
    generatedCount: links.length,
    links,
  });
}
