import { NextResponse } from "next/server";
import { createAccount } from "@/lib/server/accountAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { ok: false, error: "invalid_signup_payload" },
      { status: 400 },
    );
  }

  try {
    const userRole =
      body.userRole === "therapist" || body.userRole === "admin"
        ? body.userRole
        : "patient";

    const created = await createAccount({
      userRole,
      organizationId: body.organizationId ? String(body.organizationId) : undefined,
      therapistUserId: body.therapistUserId
        ? String(body.therapistUserId)
        : undefined,
      approvalState: userRole === "therapist" ? "pending" : "approved",
      loginId: String(body.loginId ?? ""),
      name: String(body.name ?? ""),
      birthDate: String(body.birthDate ?? ""),
      phoneLast4: String(body.phoneLast4 ?? ""),
      password: String(body.password ?? ""),
      gender: body.gender === "M" || body.gender === "F" ? body.gender : undefined,
      educationYears:
        body.educationYears == null || body.educationYears === ""
          ? undefined
          : Number(body.educationYears),
      onsetDate: body.onsetDate ? String(body.onsetDate) : undefined,
      hemiplegia: body.hemiplegia === "Y" ? "Y" : undefined,
      hemianopsia:
        body.hemianopsia === "LEFT" || body.hemianopsia === "RIGHT"
          ? body.hemianopsia
          : undefined,
    });
    return NextResponse.json({ ok: true, created });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed_to_create_account";
    const status =
      message === "invalid_signup_payload"
        ? 400
        : message === "invalid_organization"
          ? 400
        : message === "account_already_exists"
          ? 409
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
