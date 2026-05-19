import { describe, expect, it } from "vitest";
import {
  getConfirmAttemptDecision,
  getNextConfirmBackoffUntil,
} from "./confirm-attempts";

describe("getConfirmAttemptDecision", () => {
  it("allows confirmation when no backoff is active", () => {
    const now = new Date("2026-05-19T10:00:00.000Z");

    expect(getConfirmAttemptDecision({ backoffUntil: null }, now)).toEqual({
      allowed: true,
    });
  });

  it("blocks confirmation and reports retry seconds while backoff is active", () => {
    const now = new Date("2026-05-19T10:00:00.000Z");

    expect(getConfirmAttemptDecision({ backoffUntil: "2026-05-19T10:02:15.000Z" }, now)).toEqual({
      allowed: false,
      retryAfterSeconds: 135,
    });
  });
});

describe("getNextConfirmBackoffUntil", () => {
  it("uses a capped exponential-ish backoff schedule after failed attempts", () => {
    const now = new Date("2026-05-19T10:00:00.000Z");

    expect(getNextConfirmBackoffUntil(1, now).toISOString()).toBe("2026-05-19T10:00:15.000Z");
    expect(getNextConfirmBackoffUntil(4, now).toISOString()).toBe("2026-05-19T10:02:00.000Z");
    expect(getNextConfirmBackoffUntil(20, now).toISOString()).toBe("2026-05-19T10:30:00.000Z");
  });
});
