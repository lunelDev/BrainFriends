import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  createAccount,
  getAuthenticatedSessionContext,
} from "@/lib/server/accountAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TherapistProvisionBody = {
  loginId?: string;
  name?: string;
  birthDate?: string;
  phoneLast4?: string;
  password?: string;
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
