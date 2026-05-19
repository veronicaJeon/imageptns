import { describe, expect, it } from "vitest";
import { createStaticKrwUsdcQuote, isQuoteExpired } from "./quote";

describe("createStaticKrwUsdcQuote", () => {
  it("snapshots the configured USDC/KRW quote with a fixed expiry", () => {
    const now = new Date("2026-05-19T10:00:00.000Z");

    expect(createStaticKrwUsdcQuote(0.00075, now)).toEqual({
      usdcPerKrw: 0.00075,
      source: "env:ONCHAIN_USDC_PER_KRW",
      createdAt: "2026-05-19T10:00:00.000Z",
      expiresAt: "2026-05-19T10:15:00.000Z",
      ttlMinutes: 15,
    });
  });
});

describe("isQuoteExpired", () => {
  it("treats the exact expiry instant as expired", () => {
    expect(isQuoteExpired("2026-05-19T10:15:00.000Z", new Date("2026-05-19T10:14:59.999Z"))).toBe(false);
    expect(isQuoteExpired("2026-05-19T10:15:00.000Z", new Date("2026-05-19T10:15:00.000Z"))).toBe(true);
  });
});
