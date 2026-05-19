import { describe, expect, it, vi } from "vitest";
import { recordAdminAuditLog } from "./audit";

describe("recordAdminAuditLog", () => {
  it("inserts a compact admin audit row", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const admin = {
      from: vi.fn(() => ({ insert })),
    };

    await recordAdminAuditLog(admin, {
      actorId: "admin-1",
      action: "commission_policy.created",
      targetType: "commission_policy",
      targetId: "policy-1",
      targetLabel: "기본 수수료",
      before: null,
      after: { rate: 0.2 },
      reason: "initial setup",
      metadata: { source: "admin" },
    });

    expect(admin.from).toHaveBeenCalledWith("admin_audit_logs");
    expect(insert).toHaveBeenCalledWith({
      actor_id: "admin-1",
      action: "commission_policy.created",
      target_type: "commission_policy",
      target_id: "policy-1",
      target_label: "기본 수수료",
      before_data: null,
      after_data: { rate: 0.2 },
      reason: "initial setup",
      metadata: { source: "admin" },
    });
  });
});
