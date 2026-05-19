import { describe, expect, it } from "vitest";
import {
  authorizeOnchainCheckoutConfirmation,
  createOnchainConfirmToken,
} from "./checkout-auth";

describe("authorizeOnchainCheckoutConfirmation", () => {
  it("allows the authenticated buyer without a confirmation token", () => {
    expect(
      authorizeOnchainCheckoutConfirmation({
        orderBuyerId: "buyer-1",
        authenticatedUserId: "buyer-1",
        storedConfirmToken: "stored-token",
        providedConfirmToken: null,
      }),
    ).toBe(true);
  });

  it("allows a matching confirmation token without an authenticated user", () => {
    expect(
      authorizeOnchainCheckoutConfirmation({
        orderBuyerId: "buyer-1",
        authenticatedUserId: null,
        storedConfirmToken: "stored-token",
        providedConfirmToken: "stored-token",
      }),
    ).toBe(true);
  });

  it("rejects callers without the buyer session or a matching token", () => {
    expect(
      authorizeOnchainCheckoutConfirmation({
        orderBuyerId: "buyer-1",
        authenticatedUserId: "buyer-2",
        storedConfirmToken: "stored-token",
        providedConfirmToken: "wrong-token",
      }),
    ).toBe(false);
  });

  it("does not authorize empty confirmation tokens", () => {
    expect(
      authorizeOnchainCheckoutConfirmation({
        orderBuyerId: "buyer-1",
        authenticatedUserId: null,
        storedConfirmToken: "",
        providedConfirmToken: "",
      }),
    ).toBe(false);
  });
});

describe("createOnchainConfirmToken", () => {
  it("creates a 32-byte hex token", () => {
    expect(createOnchainConfirmToken()).toMatch(/^[0-9a-f]{64}$/);
  });
});
