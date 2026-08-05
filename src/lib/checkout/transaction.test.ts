import { describe, expect, it } from "vitest";
import {
  allowIncompleteDisclosureForBeta,
  checkoutRequestHash,
  checkoutRequiresPublishedDisclosure,
  isUuid,
} from "./transaction";

describe("checkout transaction policy", () => {
  it("allows incomplete disclosures only through an explicit beta override", () => {
    expect(allowIncompleteDisclosureForBeta(undefined)).toBe(false);
    expect(allowIncompleteDisclosureForBeta("false")).toBe(false);
    expect(allowIncompleteDisclosureForBeta("true")).toBe(true);
  });

  it("requires public disclosures only for paid bank-transfer orders", () => {
    expect(checkoutRequiresPublishedDisclosure("bank_transfer", 11_000)).toBe(true);
    expect(checkoutRequiresPublishedDisclosure("bank_transfer", 0)).toBe(false);
    expect(checkoutRequiresPublishedDisclosure("toss", 11_000)).toBe(true);
    expect(checkoutRequiresPublishedDisclosure("base_usdc", 11_000)).toBe(false);
  });

  it("creates a stable hash independent of object key order", () => {
    expect(checkoutRequestHash({ b: 2, a: { d: 4, c: 3 } }))
      .toBe(checkoutRequestHash({ a: { c: 3, d: 4 }, b: 2 }));
    expect(checkoutRequestHash({ a: 1 })).not.toBe(checkoutRequestHash({ a: 2 }));
  });

  it("accepts UUID idempotency keys and rejects arbitrary strings", () => {
    expect(isUuid("b86d29d8-10b8-4f53-9ed1-a39341ef6068")).toBe(true);
    expect(isUuid("same-order")).toBe(false);
  });
});
