import { NextResponse } from "next/server";
import { createGetObjectSignedUrl } from "@/lib/server/ncpObjectStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { objectKey?: string };

  if (!body.objectKey) {
    return NextResponse.json({ ok: false, error: "invalid_object_key" }, { status: 400 });
  }

  try {
    const accessUrl = await createGetObjectSignedUrl({
      objectKey: body.objectKey,
    });

    return NextResponse.json({ ok: true, accessUrl });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "failed_to_create_media_access_url" },
      { status: 500 },
    );
  }
}
