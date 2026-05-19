export interface AdminAuditLog {
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  targetLabel?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

interface AdminAuditInsertRow {
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  target_label: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  reason: string | null;
  metadata: Record<string, unknown>;
}

interface AdminAuditInsertResult {
  error: { message?: string } | Error | null;
}

export interface AdminAuditClient {
  from(table: string): {
    insert(row: AdminAuditInsertRow): PromiseLike<AdminAuditInsertResult>;
  };
}

export async function recordAdminAuditLog(admin: AdminAuditClient, log: AdminAuditLog) {
  try {
    const { error } = await admin.from("admin_audit_logs").insert({
      actor_id: log.actorId ?? null,
      action: log.action,
      target_type: log.targetType,
      target_id: log.targetId ?? null,
      target_label: log.targetLabel ?? null,
      before_data: log.before ?? null,
      after_data: log.after ?? null,
      reason: log.reason ?? null,
      metadata: log.metadata ?? {},
    });

    if (error) {
      console.error("Failed to record admin audit log", {
        action: log.action,
        targetType: log.targetType,
        error,
      });
    }
  } catch (error) {
    console.error("Failed to record admin audit log", {
      action: log.action,
      targetType: log.targetType,
      error,
    });
  }
}
