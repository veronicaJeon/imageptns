import { describe, expect, it } from "vitest";
import {
  ONCHAIN_PENDING_STALE_MINUTES,
  getOnchainPendingAgeMinutes,
  isStaleOnchainPendingOrder,
} from "./reconciliation";

describe("getOnchainPendingAgeMinutes", () => {
  it("rounds down the order age in minutes", () => {
    expect(
      getOnchainPendingAgeMinutes(
        "2026-05-19T10:00:30.000Z",
        new Date("2026-05-19T10:31:29.000Z"),
      ),
    ).toBe(30);
  });

  it("returns 0 for invalid dates", () => {
    expect(getOnchainPendingAgeMinutes("not-a-date", new Date("2026-05-19T10:00:00.000Z"))).toBe(0);
  });
});

describe("isStaleOnchainPendingOrder", () => {
  it("treats pending orders older than the stale threshold as stale", () => {
    const now = new Date("2026-05-19T10:31:00.000Z");

    expect(isStaleOnchainPendingOrder("2026-05-19T10:00:00.000Z", now)).toBe(true);
    expect(isStaleOnchainPendingOrder("2026-05-19T10:02:00.000Z", now)).toBe(false);
  });

  it("uses a 30 minute default threshold", () => {
    expect(ONCHAIN_PENDING_STALE_MINUTES).toBe(30);
  });
});
