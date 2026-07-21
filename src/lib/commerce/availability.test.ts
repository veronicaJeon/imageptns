import { afterEach, describe, expect, it } from "vitest";
import { isCommerceEnabled } from "./availability";

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
});
