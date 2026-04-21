import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  createAccount,
  getAuthenticatedSessionContext,
} from "@/lib/server/accountAuth";
import {
  getTherapistRegistrationProfilesByUserIds,
  linkTherapistProfilesToOrganization,
} from "@/lib/server/therapistRegistrationProfiles";
import { findApprovedOrganizationByName } from "@/lib/server/organizationCatalogDb";
import { mirrorTherapistReview, runMirrorGuarded } from "@/lib/server/newSchemaMirror";

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
    let profileOrganizationId = profiles[0]?.organizationId ?? null;

    // solo 치료사인데 기관이 먼저 승인되어 있는 경우: requestedOrganizationName 으로
    // 역조회해서 organization_id 를 보강한다.
    // 반대 순서(기관이 아직 pending)면 역조회 결과가 null 이므로 그냥 null 로 두고,
    // 나중에 기관 승인 시점(organizations/route.ts)에서 이 app_users 행의 organization_id 가
    // COALESCE 로 채워진다.
    if (!profileOrganizationId && profiles[0]?.requestedOrganizationName) {
      const requestedName = profiles[0].requestedOrganizationName;
      const approvedOrg = await findApprovedOrganizationByName(requestedName);
      if (approvedOrg) {
        profileOrganizationId = approvedOrg.id;
        // 프로필 JSON 도 동기화 (다음부터는 fast path 로 바로 읽힘)
        await linkTherapistProfilesToOrganization(requestedName, approvedOrg.id);
      }
    }

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

    // ── 이중 쓰기 (기능 플래그 ON 일 때만) ──
    await runMirrorGuarded("therapist-review", async () => {
      await mirrorTherapistReview({
        therapistUserId,
        status,
      });
    });

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
