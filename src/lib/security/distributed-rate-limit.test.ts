import { describe, expect, it } from "vitest";
import { distributedRateLimitKey, requestIdentity } from "./distributed-rate-limit";

describe("distributedRateLimitKey", () => {
  it("does not persist the raw identity", () => {
    const key = distributedRateLimitKey("events", "203.0.113.10");
    expect(key).toMatch(/^events:[a-f0-9]{64}$/);
    expect(key).not.toContain("203.0.113.10");
  });

  it("keeps scopes isolated", () => {
    expect(distributedRateLimitKey("events", "same")).not.toBe(
      distributedRateLimitKey("presence", "same"),
    );
  });
});

describe("requestIdentity", () => {
  it("uses the first forwarded address", () => {
    expect(requestIdentity(new Headers({ "x-forwarded-for": "203.0.113.1, 10.0.0.1" })))
      .toBe("203.0.113.1");
  });
});
