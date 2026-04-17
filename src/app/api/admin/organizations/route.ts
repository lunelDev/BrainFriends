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
      const reviewed = await reviewOrganizationRegistrationRequest({
        requestId: String(body.requestId ?? ""),
        status: body.status === "rejected" ? "rejected" : "approved",
        reviewerLoginId: auth.context.userId,
      });

      let organization = null;
      if (reviewed.status === "approved") {
        organization = await createManagedOrganization({
          name: reviewed.organizationName,
          address: reviewed.address,
          businessNumber: reviewed.businessNumber,
          representativeName: reviewed.representativeName,
          organizationPhone: reviewed.organizationPhone,
        });
      }

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
