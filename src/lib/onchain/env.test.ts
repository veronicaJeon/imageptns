import { afterEach, describe, expect, it } from "vitest";
import { isOnchainEnabled } from "./env";

const originalValue = process.env.NEXT_PUBLIC_ONCHAIN_ENABLED;

afterEach(() => {
  if (originalValue === undefined) delete process.env.NEXT_PUBLIC_ONCHAIN_ENABLED;
  else process.env.NEXT_PUBLIC_ONCHAIN_ENABLED = originalValue;
});

describe("onchain feature availability", () => {
  it("is disabled unless production explicitly enables it", () => {
    delete process.env.NEXT_PUBLIC_ONCHAIN_ENABLED;
    expect(isOnchainEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_ONCHAIN_ENABLED = "false";
    expect(isOnchainEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_ONCHAIN_ENABLED = "true";
    expect(isOnchainEnabled()).toBe(true);
  });
});
