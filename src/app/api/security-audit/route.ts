import { NextResponse } from "next/server";
import type { SecurityAuditEvent } from "@/lib/security/auditLogger";
import { listRecentSecurityAuditEvents, appendSecurityAuditEvent } from "@/lib/server/securityAuditDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as SecurityAuditEvent | null;
  if (!body?.eventType || !body?.detail || !body?.createdAt) {
    return NextResponse.json(
      { ok: false, error: "invalid_security_audit_payload" },
      { status: 400 },
    );
  }

  await appendSecurityAuditEvent(body);
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const events = await listRecentSecurityAuditEvents(30);
  return NextResponse.json({ ok: true, events });
}
