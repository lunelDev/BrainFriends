import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  getAuthenticatedSessionContext,
} from "@/lib/server/accountAuth";
import { getAvailableOrganizationById } from "@/lib/server/organizationCatalogDb";
import { listApprovedTherapistsByOrganization } from "@/lib/server/organizationTherapistsDb";
import { createOrReplacePatientLinkRequest } from "@/lib/server/patientLinkRequests";
import { getDbPool } from "@/lib/server/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const context = await getAuthenticatedSessionContext(token);
  if (!context || context.userRole !== "patient") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const organizationId = String(body?.organizationId ?? "").trim();
  const therapistUserId = String(body?.therapistUserId ?? "").trim();

  if (!organizationId || !therapistUserId) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const organization = await getAvailableOrganizationById(organizationId);
  if (!organization) {
    return NextResponse.json({ ok: false, error: "invalid_organization" }, { status: 400 });
  }

  const therapists = await listApprovedTherapistsByOrganization(organizationId);
  const therapist = therapists.find(
    (item) => item.therapistUserId === therapistUserId,
  );
  if (!therapist) {
    return NextResponse.json({ ok: false, error: "invalid_therapist" }, { status: 400 });
  }

  const pool = getDbPool();
  await pool.query(`
    ALTER TABLE app_users
    ADD COLUMN IF NOT EXISTS organization_id UUID NULL
  `);

  await pool.query(
    `
      UPDATE app_users
      SET organization_id = $2::uuid, updated_at = NOW()
      WHERE user_id = $1::uuid
    `,
    [context.userId, organizationId],
  );

  await createOrReplacePatientLinkRequest({
    patientUserId: context.userId,
    patientId: context.patientId,
    patientName: context.patient.name,
    organizationId,
    organizationName: organization.name,
    therapistUserId,
    therapistName: therapist.therapistName,
  });

  return NextResponse.json({ ok: true });
}
