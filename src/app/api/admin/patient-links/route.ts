import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  AUTH_COOKIE_NAME,
  getAuthenticatedSessionContext,
} from "@/lib/server/accountAuth";
import { reviewPatientLinkRequest } from "@/lib/server/patientLinkRequests";
import { getDbPool } from "@/lib/server/postgres";
import { mirrorPatientLinkApproval, runMirrorGuarded } from "@/lib/server/newSchemaMirror";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReviewBody = {
  requestId?: string;
  status?: "approved" | "rejected";
  patientUserId?: string;
  patientId?: string;
  organizationId?: string;
  therapistUserId?: string;
};

export async function PATCH(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const context = await getAuthenticatedSessionContext(token);
  if (!context || context.userRole !== "admin") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as ReviewBody | null;
  const requestId = String(body?.requestId ?? "").trim();
  const status = body?.status === "rejected" ? "rejected" : "approved";
  const patientUserId = String(body?.patientUserId ?? "").trim();
  const patientId = String(body?.patientId ?? "").trim();
  const organizationId = String(body?.organizationId ?? "").trim();
  const therapistUserId = String(body?.therapistUserId ?? "").trim();

  if (!requestId || !patientUserId || !patientId || !organizationId || !therapistUserId) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  try {
    if (status === "approved") {
      const pool = getDbPool();
      await pool.query(`
        ALTER TABLE app_users
        ADD COLUMN IF NOT EXISTS organization_id UUID NULL
      `);
      await pool.query(`
        ALTER TABLE patient_pii
        ADD COLUMN IF NOT EXISTS organization_id UUID NULL
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS therapist_patient_assignments (
          assignment_id UUID PRIMARY KEY,
          organization_id UUID NULL,
          therapist_user_id UUID NOT NULL,
          patient_id UUID NOT NULL,
          assigned_by UUID NULL,
          assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (therapist_user_id, patient_id)
        )
      `);

      await pool.query(
        `
          UPDATE app_users
          SET organization_id = $2::uuid, updated_at = NOW()
          WHERE user_id = $1::uuid
        `,
        [patientUserId, organizationId],
      );
      await pool.query(
        `
          UPDATE patient_pii
          SET organization_id = $2::uuid, updated_at = NOW()
          WHERE patient_id = $1::uuid
        `,
        [patientId, organizationId],
      );

      const updated = await pool.query(
        `
          UPDATE therapist_patient_assignments
          SET
            organization_id = $3::uuid,
            assigned_by = $4::uuid,
            is_active = TRUE,
            assigned_at = NOW(),
            updated_at = NOW()
          WHERE therapist_user_id = $1::uuid
            AND patient_id = $2::uuid
        `,
        [therapistUserId, patientId, organizationId, context.userId],
      );

      if (!updated.rowCount) {
        await pool.query(
          `
            INSERT INTO therapist_patient_assignments (
              assignment_id,
              organization_id,
              therapist_user_id,
              patient_id,
              assigned_by,
              assigned_at,
              is_active,
              updated_at
            )
            VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, NOW(), TRUE, NOW())
          `,
          [randomUUID(), organizationId, therapistUserId, patientId, context.userId],
        );
      }
    }

    const reviewed = await reviewPatientLinkRequest({
      requestId,
      status,
      reviewedBy: context.userId,
    });

    // ── 이중 쓰기 (기능 플래그 ON 일 때만) ──
    await runMirrorGuarded("patient-link", async () => {
      await mirrorPatientLinkApproval({
        patientUserId,
        therapistUserId,
        legacyOrganizationId: organizationId,
        status,
      });
    });

    return NextResponse.json({ ok: true, reviewed });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed_to_review_patient_link";
    const code =
      message === "patient_link_request_not_found"
        ? 404
        : message === "invalid_patient_link_request"
          ? 400
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status: code });
  }
}
