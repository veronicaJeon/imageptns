import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  consumeDistributedRateLimit,
  requestIdentity,
} from "@/lib/security/distributed-rate-limit";
import { boundedMetadata, readBoundedJson, RequestBodyError } from "@/lib/security/request-body";

const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function ipHash(raw: string) {
  if (!raw) return null;
  return createHash("sha256").update(raw).digest("hex");
}

export async function POST(req: NextRequest) {
  const identity = requestIdentity(req.headers);
  const rate = await consumeDistributedRateLimit({
    scope: "presence",
    identity,
    limit: 120,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: rate.unavailable ? "Presence service temporarily unavailable" : "Too many presence updates" },
      {
        status: rate.unavailable ? 503 : 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await readBoundedJson(req, 8 * 1024);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400;
    return NextResponse.json({ error: "Invalid presence payload" }, { status });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 128) : "";
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    return NextResponse.json({ error: "Valid sessionId is required" }, { status: 400 });
  }

  let metadata;
  try {
    metadata = boundedMetadata(body.metadata);
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400;
    return NextResponse.json({ error: "Invalid presence metadata" }, { status });
  }

  const now = new Date().toISOString();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();

  const { error } = await admin.from("user_presence").upsert({
    session_id: sessionId,
    user_id: user?.id ?? null,
    path: typeof body.path === "string" ? body.path.slice(0, 512) : null,
    referrer: req.headers.get("referer")?.slice(0, 512) ?? null,
    user_agent: req.headers.get("user-agent")?.slice(0, 512) ?? null,
    ip_hash: ipHash(identity),
    metadata,
    last_seen_at: now,
  }, { onConflict: "session_id" });

  if (error) {
    console.error("[presence] upsert failed", { code: error.code, message: error.message });
    return NextResponse.json({ error: "Failed to update presence" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
