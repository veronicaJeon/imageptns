import { describe, expect, it } from "vitest";
import { normalizeCommerceSettings } from "../commerce/settings";
import { calculateSubscriptionCoverage, isSubscriptionActiveNow } from "./entitlements";

const settings = normalizeCommerceSettings({
  download_access_days: 30,
  subscription_basic_downloads: 2,
  subscription_pro_downloads: 5,
  subscription_enterprise_downloads: 20,
});

describe("isSubscriptionActiveNow", () => {
  it("requires active status and an open period", () => {
    const now = new Date("2026-05-21T00:00:00.000Z");

    expect(isSubscriptionActiveNow({
      id: "sub_1",
      plan: "basic",
      status: "active",
      current_period_start: "2026-05-01T00:00:00.000Z",
      current_period_end: "2026-06-01T00:00:00.000Z",
    }, now)).toBe(true);
    expect(isSubscriptionActiveNow({
      id: "sub_2",
      plan: "basic",
      status: "cancelled",
      current_period_start: "2026-05-01T00:00:00.000Z",
      current_period_end: "2026-06-01T00:00:00.000Z",
    }, now)).toBe(false);
    expect(isSubscriptionActiveNow({
      id: "sub_3",
      plan: "basic",
      status: "active",
      current_period_start: "2026-04-01T00:00:00.000Z",
      current_period_end: "2026-05-01T00:00:00.000Z",
    }, now)).toBe(false);
  });
});

describe("calculateSubscriptionCoverage", () => {
  it("covers paid items up to the remaining plan quota", () => {
    const result = calculateSubscriptionCoverage({
      items: [
        { id: "image-1", license: "commercial", priceKrw: 10000 },
        { id: "image-2", license: "commercial", priceKrw: 12000 },
        { id: "image-3", license: "commercial", priceKrw: 15000 },
      ],
      subscription: {
        id: "sub_1",
        plan: "basic",
        status: "active",
        current_period_start: "2026-05-01T00:00:00.000Z",
        current_period_end: "2026-06-01T00:00:00.000Z",
      },
      settings,
      usedCount: 1,
      now: new Date("2026-05-21T00:00:00.000Z"),
    });

    expect(result.remainingBeforeOrder).toBe(1);
    expect(result.coveredCount).toBe(1);
    expect(result.items.map((item) => [item.id, item.effectivePriceKrw, item.subscriptionCovered])).toEqual([
      ["image-1", 0, true],
      ["image-2", 12000, false],
      ["image-3", 15000, false],
    ]);
  });

  it("does not spend quota on already-free items or expired subscriptions", () => {
    const result = calculateSubscriptionCoverage({
      items: [
        { id: "free", license: "editorial", priceKrw: 0 },
        { id: "paid", license: "commercial", priceKrw: 10000 },
      ],
      subscription: {
        id: "sub_1",
        plan: "basic",
        status: "active",
        current_period_start: "2026-04-01T00:00:00.000Z",
        current_period_end: "2026-05-01T00:00:00.000Z",
      },
      settings,
      usedCount: 0,
      now: new Date("2026-05-21T00:00:00.000Z"),
    });

    expect(result.coveredCount).toBe(0);
    expect(result.remainingBeforeOrder).toBe(0);
    expect(result.items.map((item) => item.effectivePriceKrw)).toEqual([0, 10000]);
  });
});
