import { NextResponse } from "next/server";
import { listAvailableOrganizations } from "@/lib/server/organizationCatalogDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const organizations = await listAvailableOrganizations();
  return NextResponse.json({ ok: true, organizations });
}
