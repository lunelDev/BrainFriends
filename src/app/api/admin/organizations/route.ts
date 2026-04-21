import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  getAuthenticatedSessionContext,
} from "@/lib/server/accountAuth";
import {
  createManagedOrganization,
  listAvailableOrganizations,
} from "@/lib/server/organizationCatalogDb";
import {
  listOrganizationRegistrationRequests,
  reviewOrganizationRegistrationRequest,
} from "@/lib/server/organizationRegistrationRequests";
import { linkTherapistProfilesToOrganization } from "@/lib/server/therapistRegistrationProfiles";
import { mirrorOrganizationReview, runMirrorGuarded } from "@/lib/server/newSchemaMirror";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdminContext() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return { error: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }) };
  }

  const context = await getAuthenticatedSessionContext(token).catch(() => null);
  if (!context || context.userRole !== "admin") {
    return { error: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };
  }

  return { context, token };
}

export async function GET() {
  const auth = await requireAdminContext();
  if ("error" in auth) return auth.error;

  const [organizations, requests] = await Promise.all([
    listAvailableOrganizations(),
    listOrganizationRegistrationRequests(),
  ]);

  return NextResponse.json({ ok: true, organizations, requests });
}

export async function POST(req: Request) {
  const auth = await requireAdminContext();
  if ("error" in auth) return auth.error;

  const body = (await req.json().catch(() => null)) as
    | {
        action?: "create" | "review";
        name?: string;
        address?: string;
        businessNumber?: string;
        representativeName?: string;
        organizationPhone?: string;
        requestId?: string;
        status?: "approved" | "rejected";
      }
    | null;

  if (!body) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  if (body.action === "review") {
    try {
      const requestId = String(body.requestId ?? "");
      const targetStatus = body.status === "rejected" ? "rejected" : "approved";

      // 승인인 경우 createManagedOrganization을 먼저 시도한다.
      // 이전 구조: request status를 먼저 'approved'로 찍고 나서 org 생성 → 후자 실패 시
      //          request만 approved로 남고 manual-organizations.json에는 빠져 유실됐음.
      // 새 구조: 실물 org 생성이 성공해야 request를 approved로 확정한다.
      let organization = null;
      if (targetStatus === "approved") {
        const pendingRequests = await listOrganizationRegistrationRequests();
        const found = pendingRequests.find((item) => item.id === requestId);
        if (!found) {
          return NextResponse.json({ ok: false, error: "request_not_found" }, { status: 404 });
        }
        if (found.status !== "pending") {
          return NextResponse.json(
            { ok: false, error: "request_already_reviewed" },
            { status: 409 },
          );
        }

        const assembledAddress = `${found.roadAddress ?? ""} ${found.addressDetail ?? ""}`.trim();
        organization = await createManagedOrganization({
          name: found.organizationName,
          // 소재지를 비워둔 채 승인된 기존 요청도 수용되도록 폴백.
          address: assembledAddress || found.organizationName || "주소 미입력",
          businessNumber: found.businessNumber,
          representativeName: found.representativeName,
          organizationPhone: found.organizationPhone,
          organizationType: found.organizationType,
          careInstitutionNumber: found.careInstitutionNumber,
          medicalInstitutionCode: found.medicalInstitutionCode,
          medicalDepartments: found.medicalDepartments,
          postalCode: found.postalCode,
          roadAddress: found.roadAddress,
          addressDetail: found.addressDetail,
          contactName: found.contactName,
          contactTitle: found.contactTitle,
          contactPhone: found.contactPhone,
          contactEmail: found.contactEmail,
          adminLoginEmail: found.adminLoginEmail,
          twoFactorMethod: found.twoFactorMethod,
          servicePurpose: found.servicePurpose,
          targetPatients: found.targetPatients,
          doctorName: found.doctorName,
          doctorLicenseNumber: found.doctorLicenseNumber,
        });
      }

      // org 생성까지 성공했거나 rejected인 경우에만 request 상태를 최종 확정.
      const reviewed = await reviewOrganizationRegistrationRequest({
        requestId,
        status: targetStatus,
        reviewerLoginId: auth.context.userId,
      });

      // solo 치료사 ↔ 신규 기관 연결.
      // 가입 시 치료사 프로필에는 organizationId 없이 requestedOrganizationName 만 저장되므로,
      // 기관이 승인되는 이 시점에 역방향으로 id 를 주입해 준다.
      // 치료사가 이미 먼저 승인된 경우에도 app_users.organization_id 가 null 로 남아 있을 수
      // 있으므로 COALESCE 로 비어 있는 행만 채운다 (기존 연결은 보호).
      if (organization) {
        const linkedUserIds = await linkTherapistProfilesToOrganization(
          reviewed.organizationName,
          organization.id,
        );
        if (linkedUserIds.length) {
          const { getDbPool } = await import("@/lib/server/postgres");
          const pool = getDbPool();
          await pool.query(
            `ALTER TABLE app_users ADD COLUMN IF NOT EXISTS organization_id UUID NULL`,
          );
          await pool.query(
            `
              UPDATE app_users
                 SET organization_id = COALESCE(organization_id, $2::uuid),
                     updated_at = NOW()
               WHERE user_id = ANY($1::uuid[])
                 AND user_role = 'therapist'
            `,
            [linkedUserIds, organization.id],
          );
        }
      }

      // ── 이중 쓰기 (기능 플래그 ON 일 때만) ──
      await runMirrorGuarded("organization-review", async () => {
        await mirrorOrganizationReview({
          legacyOrganizationId: organization?.id ?? null,
          name: reviewed.organizationName,
          businessNumber: reviewed.businessNumber || null,
          representativeName: reviewed.representativeName || null,
          institutionType: reviewed.organizationType || null,
          phone: reviewed.organizationPhone || null,
          zipCode: reviewed.postalCode || null,
          address1: reviewed.roadAddress || null,
          address2: reviewed.addressDetail || null,
          businessLicenseFileUrl: null,
          status: reviewed.status === "approved" ? "APPROVED" : "REJECTED",
        });
      });

      return NextResponse.json({ ok: true, reviewed, organization });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "failed_to_review_request";
      const status =
        message === "request_not_found"
          ? 404
          : message === "request_already_reviewed"
            ? 409
            : message === "organization_already_exists"
              ? 409
              : message === "invalid_organization_payload"
                ? 400
                : 500;
      return NextResponse.json({ ok: false, error: message }, { status });
    }
  }

  try {
    const organization = await createManagedOrganization({
      name: String(body.name ?? ""),
      address: String(body.address ?? ""),
      businessNumber: String(body.businessNumber ?? ""),
      representativeName: String(body.representativeName ?? ""),
      organizationPhone: String(body.organizationPhone ?? ""),
    });
    return NextResponse.json({ ok: true, organization });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed_to_create_organization";
    const status =
      message === "invalid_organization_payload"
        ? 400
        : message === "organization_already_exists"
          ? 409
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
