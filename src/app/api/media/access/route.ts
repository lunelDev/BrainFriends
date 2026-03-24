import { NextResponse } from "next/server";
import {
  assertObjectExists,
  createGetObjectSignedUrl,
} from "@/lib/server/ncpObjectStorage";
import {
  assertLocalMediaObjectExists,
  isLocalMediaMode,
  readLocalMediaObject,
} from "@/lib/server/localMediaStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const objectKey = searchParams.get("objectKey");

  if (!objectKey) {
    return NextResponse.json({ ok: false, error: "invalid_object_key" }, { status: 400 });
  }

  try {
    if (isLocalMediaMode() && objectKey.startsWith("local-dev-media/")) {
      await assertLocalMediaObjectExists(objectKey);
      const fileBuffer = await readLocalMediaObject(objectKey);
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "content-type": "application/octet-stream",
          "cache-control": "no-store",
        },
      });
    }

    await assertObjectExists(objectKey);
    const accessUrl = await createGetObjectSignedUrl({
      objectKey,
    });

    return NextResponse.redirect(accessUrl, { status: 307 });
  } catch (error: any) {
    if (
      error?.name === "NotFound" ||
      error?.$metadata?.httpStatusCode === 404
    ) {
      return new NextResponse("media_not_found", {
        status: 404,
        headers: {
          "content-type": "text/plain; charset=utf-8",
        },
      });
    }
    return NextResponse.json(
      { ok: false, error: error?.message || "failed_to_create_media_access_url" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { objectKey?: string };

  if (!body.objectKey) {
    return NextResponse.json({ ok: false, error: "invalid_object_key" }, { status: 400 });
  }

  try {
    if (isLocalMediaMode() && body.objectKey.startsWith("local-dev-media/")) {
      await assertLocalMediaObjectExists(body.objectKey);
      return NextResponse.json({
        ok: true,
        accessUrl: `/api/media/access?objectKey=${encodeURIComponent(body.objectKey)}`,
      });
    }

    await assertObjectExists(body.objectKey);
    const accessUrl = await createGetObjectSignedUrl({
      objectKey: body.objectKey,
    });

    return NextResponse.json({ ok: true, accessUrl });
  } catch (error: any) {
    if (
      error?.name === "NotFound" ||
      error?.$metadata?.httpStatusCode === 404
    ) {
      return NextResponse.json(
        { ok: false, error: "media_not_found" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { ok: false, error: error?.message || "failed_to_create_media_access_url" },
      { status: 500 },
    );
  }
}
