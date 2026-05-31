import { describe, expect, it } from "vitest";
import { imageAssetBytes32 } from "./ids";
import { imageLedgerKey } from "./asset-ledger";

describe("imageLedgerKey", () => {
  it("uses the same deterministic key as onchain checkout when no stored key exists", () => {
    expect(imageLedgerKey("IMG-000001", null)).toBe(imageAssetBytes32("IMG-000001"));
  });

  it("prefers the stored Arweave/Base ledger key once registration persists it", () => {
    expect(imageLedgerKey("IMG-000001", "0xabc")).toBe("0xabc");
    expect(imageLedgerKey(null, null)).toBeNull();
  });
});
