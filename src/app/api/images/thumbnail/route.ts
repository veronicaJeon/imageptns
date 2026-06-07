import { NextRequest, NextResponse } from "next/server";
import { createWatermarkedThumbnail } from "@/lib/utils/watermark";

export const runtime = "nodejs";
export const maxDuration = 30;

const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 240;
const MAX_SIZE = 1200;

function clampSize(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.round(parsed), 32), MAX_SIZE);
}

function isAllowedPreviewUrl(src: string) {
  const configuredBase = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!configuredBase) return false;

  try {
    const source = new URL(src);
    const base = new URL(configuredBase);
    return (
      source.origin === base.origin &&
      source.pathname.includes("/storage/v1/object/public/images-preview/")
    );
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams.get("src");
  if (!src || !isAllowedPreviewUrl(src)) {
    return NextResponse.json({ error: "Invalid thumbnail source" }, { status: 400 });
  }

  const width = clampSize(req.nextUrl.searchParams.get("w"), DEFAULT_WIDTH);
  const height = clampSize(req.nextUrl.searchParams.get("h"), DEFAULT_HEIGHT);

  const response = await fetch(src, { next: { revalidate: 60 * 60 * 24 * 30 } });
  if (!response.ok) {
    return NextResponse.json({ error: "Preview image not found" }, { status: response.status });
  }

  const input = Buffer.from(await response.arrayBuffer());
  const output = await createWatermarkedThumbnail(input, width, height);

  return new NextResponse(new Uint8Array(output), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(output.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Disposition": "inline; filename=\"imagepartners-thumbnail.jpg\"",
    },
  });
}
