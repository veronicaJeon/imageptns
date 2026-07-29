import { createHash } from "node:crypto";
import { createAdminClient } from "../supabase/admin";

interface DistributedRateLimitOptions {
  scope: string;
  identity: string;
  limit: number;
  windowSeconds: number;
}

interface RateLimitRow {
  allowed: boolean;
  retry_after_seconds: number;
}

export function requestIdentity(headers: Headers) {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export function distributedRateLimitKey(scope: string, identity: string) {
  const digest = createHash("sha256").update(identity).digest("hex");
  return `${scope}:${digest}`;
}

export async function consumeDistributedRateLimit({
  scope,
  identity,
  limit,
  windowSeconds,
}: DistributedRateLimitOptions) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_api_rate_limit", {
    rate_key: distributedRateLimitKey(scope, identity),
    max_requests: limit,
    window_seconds: windowSeconds,
  });

  if (error) {
    console.error(`[rate-limit] ${scope} limiter unavailable`, {
      code: error.code,
      message: error.message,
    });
    return { allowed: false, retryAfterSeconds: 60, unavailable: true };
  }

  const row = (Array.isArray(data) ? data[0] : data) as RateLimitRow | null;
  if (!row || typeof row.allowed !== "boolean") {
    console.error(`[rate-limit] ${scope} limiter returned an invalid response`);
    return { allowed: false, retryAfterSeconds: 60, unavailable: true };
  }

  return {
    allowed: row.allowed,
    retryAfterSeconds: Math.max(0, Number(row.retry_after_seconds) || 0),
    unavailable: false,
  };
}
