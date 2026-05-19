import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 128) : "";
  if (!sessionId) return NextResponse.json({ error: "sessionId is required" }, { status: 400 });

  const now = new Date().toISOString();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();

  const { error } = await admin.from("user_presence").upsert({
    session_id: sessionId,
    user_id: user?.id ?? null,
    path: typeof body.path === "string" ? body.path.slice(0, 512) : null,
    referrer: req.headers.get("referer"),
    user_agent: req.headers.get("user-agent"),
    ip_hash: ipHash(req),
    metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata : {},
    last_seen_at: now,
  }, { onConflict: "session_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
