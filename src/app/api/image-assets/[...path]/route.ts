import { NextRequest, NextResponse } from "next/server";
import { getR2ImageObject } from "@/lib/storage/image-storage-server";
import { isPublicR2PreviewPath } from "@/lib/storage/image-path";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const path = segments.join("/");
  if (!isPublicR2PreviewPath(path)) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  try {
    const object = await getR2ImageObject("images-preview", path);
    if (!object) return NextResponse.json({ error: "Image not found" }, { status: 404 });

    if (req.headers.get("if-none-match") === object.httpEtag) {
      return new NextResponse(null, { status: 304, headers: { ETag: object.httpEtag } });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("ETag", object.httpEtag);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("X-Content-Type-Options", "nosniff");
    return new NextResponse(object.body, { headers });
  } catch (error) {
    console.error("[image-assets] R2 preview read failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Image temporarily unavailable" }, { status: 503 });
  }
}
