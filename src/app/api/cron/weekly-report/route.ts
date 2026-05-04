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
import {
  createWeeklyReportDelivery,
  listRecentWeeklyReportDeliveries,
  type DeliveryMode,
} from "@/lib/server/weeklyReportSender";

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
  const deliveryEvidence = await listRecentWeeklyReportDeliveries(20).catch((error) => ({
    records: [],
    summary: {
      total: 0,
      dryRun: 0,
      pending: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      latestCreatedAt: null,
    },
    error: error instanceof Error ? error.message : String(error),
  }));
  return NextResponse.json({
    ok: true,
    mode: "preview",
    delivery: "preview_only",
    candidates,
    deliveryEvidence,
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
  const deliveryMode: DeliveryMode = body?.deliveryMode === "send" ? "send" : "dry_run";

  const candidates = await listGuardianWeeklyReportCandidates({
    createdByUserId: operator.userId ?? "00000000-0000-0000-0000-000000000000",
    userRole: operator.userRole,
    patientIds,
  });
  const results = await Promise.all(
    candidates.map((candidate) =>
      createGuardianReportLink({
        patientId: candidate.patientId,
        createdByUserId: operator.userId,
        recipientLabel: "주간 보호자 리포트",
        ttlDays,
      }).then(async (link) => {
        const url = buildAbsoluteUrl(req, link.urlPath);
        const status = deliveryMode === "dry_run" ? "dry_run" : "skipped";
        const reason =
          deliveryMode === "dry_run"
            ? "dry_run_not_sent"
            : "no_delivery_channel_configured";
        const delivery = await createWeeklyReportDelivery({
          patientId: candidate.patientId,
          patientPseudonymId: link.patientPseudonymId,
          linkId: link.id,
          reportUrl: url,
          recipientLabel: "주간 보호자 리포트",
          channel: null,
          deliveryMode,
          status,
          reason,
          requestedByUserId: operator.userId,
          latestCompletedAt: candidate.latestCompletedAt,
          metadata: {
            maskedName: candidate.maskedName,
            cronMode: deliveryMode,
            generatedBy: operator.userRole,
          },
        });
        return {
          patientId: candidate.patientId,
          maskedName: candidate.maskedName,
          latestCompletedAt: candidate.latestCompletedAt,
          url,
          expiresAt: link.expiresAt,
          delivery,
        };
      }),
    ),
  );
  const deliveryEvidence = await listRecentWeeklyReportDeliveries(20);

  return NextResponse.json({
    ok: true,
    mode: deliveryMode === "send" ? "delivery_attempt" : "dry_run",
    delivery: deliveryMode === "send" ? "skipped_no_channel" : "dry_run_recorded",
    generatedCount: results.length,
    links: results.map(({ delivery, ...link }) => link),
    deliveries: results.map((result) => result.delivery),
    deliveryEvidence,
  });
}
