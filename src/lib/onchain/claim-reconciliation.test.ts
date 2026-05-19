import { describe, expect, it } from "vitest";
import {
  aggregateClaimableByPhotographer,
  compareClaimableAmounts,
} from "./claim-reconciliation";

describe("aggregateClaimableByPhotographer", () => {
  it("groups claimable DB rows by photographer and wallet in USDC units", () => {
    expect(
      aggregateClaimableByPhotographer([
        {
          photographer_id: "photographer-1",
          claimable_amount: "1.25",
          photographer: { wallet_address: "0x0000000000000000000000000000000000000001" },
        },
        {
          photographer_id: "photographer-1",
          claimable_amount: "0.75",
          photographer: { wallet_address: "0x0000000000000000000000000000000000000001" },
        },
        {
          photographer_id: "photographer-2",
          claimable_amount: "3",
          photographer: { wallet_address: null },
        },
      ]),
    ).toEqual([
      {
        photographerId: "photographer-1",
        walletAddress: "0x0000000000000000000000000000000000000001",
        rowCount: 2,
        dbClaimableUnits: BigInt(2_000_000),
        dbClaimableUsdc: "2",
      },
      {
        photographerId: "photographer-2",
        walletAddress: null,
        rowCount: 1,
        dbClaimableUnits: BigInt(3_000_000),
        dbClaimableUsdc: "3",
      },
    ]);
  });
});

describe("compareClaimableAmounts", () => {
  it("marks exact matches and mismatches", () => {
    expect(compareClaimableAmounts(BigInt(2_000_000), BigInt(2_000_000))).toEqual({
      status: "matched",
      deltaUnits: BigInt(0),
      deltaUsdc: "0",
    });
    expect(compareClaimableAmounts(BigInt(2_000_000), BigInt(1_500_000))).toEqual({
      status: "mismatch",
      deltaUnits: BigInt(500_000),
      deltaUsdc: "0.5",
    });
  });
});
