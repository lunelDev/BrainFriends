import { NextResponse } from "next/server";
import { createOrganizationRegistrationRequest } from "@/lib/server/organizationRegistrationRequests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | {
        organizationName?: string;
        businessNumber?: string;
        representativeName?: string;
        organizationPhone?: string;
        address?: string;
        contactName?: string;
        contactPhone?: string;
        contactEmail?: string;
      }
    | null;

  if (!body) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  try {
    const request = await createOrganizationRegistrationRequest({
      organizationName: body.organizationName ?? "",
      businessNumber: body.businessNumber ?? "",
      representativeName: body.representativeName ?? "",
      organizationPhone: body.organizationPhone ?? "",
      address: body.address ?? "",
      contactName: body.contactName ?? "",
      contactPhone: body.contactPhone ?? "",
      contactEmail: body.contactEmail ?? "",
    });
    return NextResponse.json({ ok: true, request });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed_to_create_request";
    const status = message === "invalid_request_payload" ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
