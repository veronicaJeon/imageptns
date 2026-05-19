import { describe, expect, it } from "vitest";
import { filterOnchainEarnings, sumClaimableUsdc } from "./earnings";

const rows = [
  { settlement_provider: "onchain_escrow", claim_status: "claimable", claimable_amount: "1.25" },
  { settlement_provider: "onchain_escrow", claim_status: "claimed", claimable_amount: "2.5" },
  { settlement_provider: "offchain", claim_status: "not_applicable", claimable_amount: null },
];

describe("filterOnchainEarnings", () => {
  it("returns only onchain escrow rows for all status", () => {
    expect(filterOnchainEarnings(rows, "all")).toHaveLength(2);
  });

  it("filters onchain rows by claim status", () => {
    expect(filterOnchainEarnings(rows, "claimable")).toEqual([rows[0]]);
    expect(filterOnchainEarnings(rows, "claimed")).toEqual([rows[1]]);
  });
});

describe("sumClaimableUsdc", () => {
  it("sums decimal claimable amounts", () => {
    expect(sumClaimableUsdc(rows)).toBe(3.75);
  });
});
