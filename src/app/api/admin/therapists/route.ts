import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  createAccount,
  getAuthenticatedSessionContext,
} from "@/lib/server/accountAuth";
import { getTherapistRegistrationProfilesByUserIds } from "@/lib/server/therapistRegistrationProfiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TherapistProvisionBody = {
  loginId?: string;
  name?: string;
  birthDate?: string;
  phoneLast4?: string;
  password?: string;
};

type TherapistReviewBody = {
  therapistUserId?: string;
  status?: "approved" | "rejected";
};

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const context = await getAuthenticatedSessionContext(token);
  if (!context || context.userRole !== "admin") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as TherapistProvisionBody | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  try {
    const created = await createAccount({
      userRole: "therapist",
      loginId: String(body.loginId ?? ""),
      name: String(body.name ?? ""),
      birthDate: String(body.birthDate ?? ""),
      phoneLast4: String(body.phoneLast4 ?? ""),
      password: String(body.password ?? ""),
      gender: "U",
    });

    return NextResponse.json({ ok: true, ...created });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed_to_create_therapist";
    const status =
      message === "invalid_signup_payload"
        ? 400
        : message === "account_already_exists"
          ? 409
          : 500;

    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

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

  const body = (await req.json().catch(() => null)) as TherapistReviewBody | null;
  const therapistUserId = String(body?.therapistUserId ?? "").trim();
  const status = body?.status === "rejected" ? "rejected" : "approved";

  if (!therapistUserId) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  try {
    const { getDbPool } = await import("@/lib/server/postgres");
    const pool = getDbPool();
    await pool.query(
      `
        ALTER TABLE app_users
        ADD COLUMN IF NOT EXISTS approval_state VARCHAR(20) NOT NULL DEFAULT 'approved'
      `,
    );
    await pool.query(
      `
        ALTER TABLE app_users
        ADD COLUMN IF NOT EXISTS organization_id UUID NULL
      `,
    );

    const profiles = await getTherapistRegistrationProfilesByUserIds([therapistUserId]);
    const profileOrganizationId = profiles[0]?.organizationId ?? null;

    const result = await pool.query(
      `
        UPDATE app_users
        SET
          approval_state = $2,
          organization_id = COALESCE(app_users.organization_id, $3::uuid),
          updated_at = NOW()
        WHERE user_id = $1::uuid
          AND user_role = 'therapist'
        RETURNING user_id
      `,
      [therapistUserId, status, profileOrganizationId],
    );

    if (!result.rowCount) {
      return NextResponse.json({ ok: false, error: "therapist_not_found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      reviewed: {
        therapistUserId,
        approvalState: status,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed_to_review_therapist";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
