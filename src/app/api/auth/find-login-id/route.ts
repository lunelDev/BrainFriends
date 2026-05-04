import { NextResponse } from "next/server";
import { findLoginIdByIdentity } from "@/lib/server/accountAuth";
import {
  FindLoginIdInputSchema,
  validateInput,
} from "@/lib/server/inputSchemas";

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

  // SI-05: zod 통합 스키마로 검증.
  const parsed = validateInput(FindLoginIdInputSchema, body);
  if (!parsed.ok || !parsed.data) {
    return NextResponse.json(
      { ok: false, error: "invalid_recovery_payload" },
      { status: 400 },
    );
  }

  try {
    const result = await findLoginIdByIdentity({
      name: parsed.data.name,
      birthDate: parsed.data.birthDate,
      phoneLast4: parsed.data.phoneLast4,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed_to_find_login_id";
    const status =
      message === "invalid_recovery_payload"
        ? 400
        : message === "account_not_found"
          ? 404
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
