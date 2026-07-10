import { describe, expect, it } from "vitest";
import {
  decideSignupFlow,
  normalizeSignupEmail,
  normalizeSignupPassword,
  normalizeSignupRole,
  photographerIntentCreatesBuyerRole,
} from "./signup-flow";

describe("signup flow", () => {
  it("creates an account when the email is not registered", () => {
    expect(decideSignupFlow({ userExists: false, emailConfirmed: false, providers: [] })).toBe("create_account");
  });

  it("resends confirmation when the email exists but is not confirmed", () => {
    expect(decideSignupFlow({ userExists: true, emailConfirmed: false, providers: ["email"] })).toBe("resend_confirmation");
  });

  it("shows the existing-account notice when the email is already confirmed", () => {
    expect(decideSignupFlow({ userExists: true, emailConfirmed: true, providers: ["email"] })).toBe("show_existing_account");
  });

  it("normalizes signup fields defensively", () => {
    expect(normalizeSignupEmail(" Buyer@Example.COM ")).toBe("buyer@example.com");
    expect(normalizeSignupRole("photographer")).toBe("photographer");
    expect(normalizeSignupRole("unexpected")).toBe("buyer");
    expect(normalizeSignupPassword("12345678")).toBe("12345678");
    expect(() => normalizeSignupPassword("short")).toThrow("8자 이상");
  });

  it("keeps photographer signup as buyer role until admin approval", () => {
    expect(photographerIntentCreatesBuyerRole("photographer")).toEqual({
      role: "buyer",
      roles: ["buyer"],
      photographer_status: "pending",
      shouldCreateApplication: true,
    });
    expect(photographerIntentCreatesBuyerRole("buyer")).toEqual({
      role: "buyer",
      roles: ["buyer"],
      photographer_status: "none",
      shouldCreateApplication: false,
    });
  });
});
