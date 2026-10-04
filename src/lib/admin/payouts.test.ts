import { describe, expect, it } from "vitest";
import {
  isPayoutAction,
  isPayoutActionable,
  normalizePayoutNote,
  payoutActionUpdates,
  payoutAuditAction,
} from "./payouts";

describe("payout admin actions", () => {
  it("only allows pending or processing payouts to be approved or rejected", () => {
    expect(isPayoutActionable("pending")).toBe(true);
    expect(isPayoutActionable("processing")).toBe(true);
    expect(isPayoutActionable("paid")).toBe(false);
    expect(isPayoutActionable("rejected")).toBe(false);
    expect(isPayoutActionable("failed")).toBe(false);
    expect(isPayoutActionable(null)).toBe(false);
  });

  it("accepts only approve and reject actions", () => {
    expect(isPayoutAction("approve")).toBe(true);
    expect(isPayoutAction("reject")).toBe(true);
    expect(isPayoutAction("paid")).toBe(false);
    expect(isPayoutAction(undefined)).toBe(false);
  });

  it("sets paid_at only when approving", () => {
    const now = new Date("2026-10-04T12:00:00.000Z");
    expect(payoutActionUpdates("approve", "확인", now)).toEqual({
      status: "paid",
      paid_at: "2026-10-04T12:00:00.000Z",
      note: "확인",
    });
    expect(payoutActionUpdates("reject", null, now)).toEqual({ status: "rejected", note: null });
  });

  it("names audit actions and trims notes", () => {
    expect(payoutAuditAction("approve")).toBe("payout.approved");
    expect(payoutAuditAction("reject")).toBe("payout.rejected");
    expect(normalizePayoutNote("  계좌 오류  ")).toBe("계좌 오류");
    expect(normalizePayoutNote("   ")).toBeNull();
    expect(normalizePayoutNote(42)).toBeNull();
    expect(normalizePayoutNote("가".repeat(1200))?.length).toBe(1000);
  });
});
