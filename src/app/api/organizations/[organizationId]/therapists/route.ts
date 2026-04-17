import { NextResponse } from "next/server";
import { listApprovedTherapistsByOrganization } from "@/lib/server/organizationTherapistsDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const params = await context.params;
  const organizationId = String(params.organizationId ?? "").trim();
  if (!organizationId) {
    return NextResponse.json(
      { ok: false, error: "invalid_organization" },
      { status: 400 },
    );
  }

  const therapists = await listApprovedTherapistsByOrganization(organizationId);
  return NextResponse.json({ ok: true, therapists });
}
