import { createAdminClient } from "../supabase/admin";

export type OperationalStatus = "ok" | "warning" | "error";

export interface OperationalEventInput {
  eventType: string;
  component: string;
  status: OperationalStatus;
  route?: string;
  provider?: string;
  statusCode?: number;
  durationMs?: number;
  errorCode?: string;
  message?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

const SECRET_PATTERN = /(bearer\s+|api[_-]?key["'=:\s]+|token["'=:\s]+|password["'=:\s]+)[^\s,;]+/gi;

export function sanitizeOperationalMessage(value: unknown) {
  if (!value) return null;
  const message = value instanceof Error ? value.message : String(value);
  return message.replace(SECRET_PATTERN, "$1[redacted]").slice(0, 500);
}

export async function recordOperationalEvent(input: OperationalEventInput) {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("operational_events").insert({
      event_type: input.eventType,
      component: input.component,
      status: input.status,
      route: input.route ?? null,
      provider: input.provider ?? null,
      status_code: input.statusCode ?? null,
      duration_ms: input.durationMs == null ? null : Math.max(0, Math.round(input.durationMs)),
      error_code: input.errorCode?.slice(0, 100) ?? null,
      message: sanitizeOperationalMessage(input.message),
      metadata: input.metadata ?? {},
    });
    if (error) console.error("[monitoring] failed to record event", error.message);
  } catch (error) {
    console.error("[monitoring] failed to record event", sanitizeOperationalMessage(error));
  }
}
