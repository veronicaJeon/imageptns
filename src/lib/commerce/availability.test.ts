import { afterEach, describe, expect, it } from "vitest";
import {
  isCheckoutPaymentProviderEnabled,
  isCheckoutRequestEnabled,
  isCommerceEnabled,
} from "./availability";

const originalValue = process.env.NEXT_PUBLIC_COMMERCE_ENABLED;

afterEach(() => {
  if (originalValue === undefined) delete process.env.NEXT_PUBLIC_COMMERCE_ENABLED;
  else process.env.NEXT_PUBLIC_COMMERCE_ENABLED = originalValue;
});
describe("commerce feature availability", () => {
  it("requires explicit production enablement", () => {
    delete process.env.NEXT_PUBLIC_COMMERCE_ENABLED;
    expect(isCommerceEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_COMMERCE_ENABLED = "false";
    expect(isCommerceEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_COMMERCE_ENABLED = "true";
    expect(isCommerceEnabled()).toBe(true);
  });

  it("keeps bank transfer public while online payments are disabled", () => {
    delete process.env.NEXT_PUBLIC_COMMERCE_ENABLED;

    expect(isCheckoutPaymentProviderEnabled("bank_transfer")).toBe(true);
    expect(isCheckoutPaymentProviderEnabled("toss")).toBe(false);
    expect(isCheckoutPaymentProviderEnabled("base_usdc")).toBe(false);
  });

  it("still permits free orders without exposing online paid methods", () => {
    delete process.env.NEXT_PUBLIC_COMMERCE_ENABLED;

    expect(isCheckoutRequestEnabled("toss", 0)).toBe(true);
    expect(isCheckoutRequestEnabled("toss", 1000)).toBe(false);
    expect(isCheckoutRequestEnabled("bank_transfer", 1000)).toBe(true);
  });
});
