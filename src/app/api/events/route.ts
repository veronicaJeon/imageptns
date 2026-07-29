import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  consumeDistributedRateLimit,
  requestIdentity,
} from "@/lib/security/distributed-rate-limit";
import { boundedMetadata, readBoundedJson, RequestBodyError } from "@/lib/security/request-body";

const EVENT_TYPES = new Set([
  "page_view",
  "image_view",
  "search",
  "cart_add",
  "checkout_started",
  "download",
  "ad_impression",
  "ad_click",
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function ipHash(raw: string) {
  if (!raw) return null;
  return createHash("sha256").update(raw).digest("hex");
}

export async function POST(req: NextRequest) {
  const identity = requestIdentity(req.headers);
  const rate = await consumeDistributedRateLimit({
    scope: "events",
    identity,
    limit: 300,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: rate.unavailable ? "Event service temporarily unavailable" : "Too many events" },
      {
        status: rate.unavailable ? 503 : 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await readBoundedJson(req, 16 * 1024);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400;
    return NextResponse.json({ error: "Invalid event payload" }, { status });
  }

  const eventType = String(body.eventType ?? "").trim();
  if (!EVENT_TYPES.has(eventType)) {
    return NextResponse.json({ error: "Invalid eventType" }, { status: 400 });
  }
  const imageId = body.imageId == null ? null : String(body.imageId);
  const orderId = body.orderId == null ? null : String(body.orderId);
  if ((imageId && !UUID_PATTERN.test(imageId)) || (orderId && !UUID_PATTERN.test(orderId))) {
    return NextResponse.json({ error: "Invalid entity identifier" }, { status: 400 });
  }

  let metadata;
  try {
    metadata = boundedMetadata(body.metadata);
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400;
    return NextResponse.json({ error: "Invalid event metadata" }, { status });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();

  const { error } = await admin.from("user_events").insert({
    user_id: user?.id ?? null,
    session_id: typeof body.sessionId === "string" ? body.sessionId.slice(0, 128) : null,
    event_type: eventType,
    path: typeof body.path === "string" ? body.path.slice(0, 512) : null,
    image_id: imageId,
    order_id: orderId,
    referrer: req.headers.get("referer")?.slice(0, 512) ?? null,
    user_agent: req.headers.get("user-agent")?.slice(0, 512) ?? null,
    ip_hash: ipHash(identity),
    metadata,
  });

  if (error) {
    console.error("[events] insert failed", { code: error.code, message: error.message });
    return NextResponse.json({ error: "Failed to record event" }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
