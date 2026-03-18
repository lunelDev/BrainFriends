import { NextResponse } from "next/server";
import { resetPasswordByIdentity } from "@/lib/server/accountAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json(
      { ok: false, error: "invalid_recovery_payload" },
      { status: 400 },
    );
  }

  try {
    const result = await resetPasswordByIdentity({
      name: String(body.name ?? ""),
      birthDate: String(body.birthDate ?? ""),
      phoneLast4: String(body.phoneLast4 ?? ""),
      newPassword: String(body.newPassword ?? ""),
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed_to_reset_password";
    const status =
      message === "invalid_recovery_payload" || message === "invalid_password_payload"
        ? 400
        : message === "account_not_found"
          ? 404
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
