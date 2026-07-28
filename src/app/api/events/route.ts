import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

function ipHash(req: NextRequest) {
  const raw = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "";
  if (!raw) return null;
  return createHash("sha256").update(raw).digest("hex");
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const eventType = String(body.eventType ?? "").trim();
  if (!EVENT_TYPES.has(eventType)) {
    return NextResponse.json({ error: "Invalid eventType" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();

  const { error } = await admin.from("user_events").insert({
    user_id: user?.id ?? null,
    session_id: typeof body.sessionId === "string" ? body.sessionId.slice(0, 128) : null,
    event_type: eventType,
    path: typeof body.path === "string" ? body.path.slice(0, 512) : null,
    image_id: body.imageId || null,
    order_id: body.orderId || null,
    referrer: req.headers.get("referer"),
    user_agent: req.headers.get("user-agent"),
    ip_hash: ipHash(req),
    metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata : {},
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
