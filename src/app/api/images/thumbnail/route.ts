import { NextRequest, NextResponse } from "next/server";
import { resizeWatermarkedPreview } from "@/lib/utils/watermark";
import {
  consumeDistributedRateLimit,
  requestIdentity,
} from "@/lib/security/distributed-rate-limit";
import { recordOperationalEvent } from "@/lib/monitoring/events";

export const runtime = "nodejs";
export const maxDuration = 30;

const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 240;
const MAX_SIZE = 1200;
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

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

function unavailableThumbnail(width: number, height: number) {
  const left = Math.round(width * 0.25);
  const top = Math.round(height * 0.22);
  const boxWidth = Math.round(width * 0.5);
  const boxHeight = Math.round(height * 0.56);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#ecebea"/>
    <g fill="none" stroke="#77716d" stroke-width="2" opacity=".75">
      <rect x="${left}" y="${top}" width="${boxWidth}" height="${boxHeight}" rx="8"/>
      <circle cx="42%" cy="40%" r="6"/>
      <polyline points="${Math.round(width * 0.28)},${Math.round(height * 0.70)} ${Math.round(width * 0.43)},${Math.round(height * 0.54)} ${Math.round(width * 0.54)},${Math.round(height * 0.64)} ${Math.round(width * 0.64)},${Math.round(height * 0.52)} ${Math.round(width * 0.72)},${Math.round(height * 0.61)}"/>
    </g>
    <text x="50%" y="88%" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#77716d">IMAGE PARTNERS</text>
  </svg>`;
  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      "X-ImagePartners-Fallback": "invalid-preview",
    },
  });
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const rate = await consumeDistributedRateLimit({
    scope: "thumbnail",
    identity: requestIdentity(req.headers),
    limit: 300,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: rate.unavailable ? "Thumbnail service temporarily unavailable" : "Too many thumbnail requests" },
      {
        status: rate.unavailable ? 503 : 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  const src = req.nextUrl.searchParams.get("src");
  if (!src || !isAllowedPreviewUrl(src)) {
    return NextResponse.json({ error: "Invalid thumbnail source" }, { status: 400 });
  }

  const width = clampSize(req.nextUrl.searchParams.get("w"), DEFAULT_WIDTH);
  const height = clampSize(req.nextUrl.searchParams.get("h"), DEFAULT_HEIGHT);

  const response = await fetch(src, { cache: "no-store" });
  if (!response.ok) {
    return NextResponse.json({ error: "Preview image not found" }, { status: response.status });
  }
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("image/")) {
    await recordOperationalEvent({
      eventType: "thumbnail_invalid_preview",
      component: "storage",
      status: "warning",
      route: "/api/images/thumbnail",
      statusCode: 200,
      durationMs: Date.now() - startedAt,
      errorCode: "invalid_content_type",
      metadata: { contentType: contentType.slice(0, 100) || "missing" },
    });
    return unavailableThumbnail(width, height);
  }
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_SOURCE_BYTES) {
    return NextResponse.json({ error: "Preview image is too large" }, { status: 413 });
  }

  const input = Buffer.from(await response.arrayBuffer());
  if (input.length > MAX_SOURCE_BYTES) {
    return NextResponse.json({ error: "Preview image is too large" }, { status: 413 });
  }
  let output: Buffer;
  try {
    output = await resizeWatermarkedPreview(input, width, height);
  } catch (error) {
    console.warn("[thumbnail] Invalid stored preview", error instanceof Error ? error.message : error);
    await recordOperationalEvent({
      eventType: "thumbnail_invalid_preview",
      component: "storage",
      status: "warning",
      route: "/api/images/thumbnail",
      statusCode: 200,
      durationMs: Date.now() - startedAt,
      errorCode: "unsupported_image",
      message: error instanceof Error ? error.message : String(error),
      metadata: { sourceBytes: input.length },
    });
    return unavailableThumbnail(width, height);
  }

  return new NextResponse(new Uint8Array(output), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(output.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Disposition": "inline; filename=\"imagepartners-thumbnail.jpg\"",
    },
  });
}
