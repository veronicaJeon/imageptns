import { describe, expect, it } from "vitest";
import {
  buildTreasuryFeeReceiptRows,
  nextScanFromBlock,
  reconcileTreasury,
  sumFeeUnits,
  toTreasuryFeeReceiptRow,
  type PurchaseCompletedLog,
} from "./treasury";

const BUYER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

function log(overrides: Partial<PurchaseCompletedLog> = {}): PurchaseCompletedLog {
  return {
    orderId: "0xABC123",
    buyer: BUYER,
    grossAmount: BigInt(100000000), // 100 USDC (6 decimals)
    platformFee: BigInt(20000000), // 20 USDC
    txHash: "0xDEADBEEF",
    blockNumber: BigInt(123),
    logIndex: 0,
    ...overrides,
  };
}

describe("toTreasuryFeeReceiptRow", () => {
  it("normalizes a PurchaseCompleted log into a receipt row", () => {
    const row = toTreasuryFeeReceiptRow(log(), 84532);
    expect(row).toMatchObject({
      contractOrderId: "0xabc123",
      buyerAddress: BUYER, // checksummed
      txHash: "0xdeadbeef",
      blockNumber: 123,
      logIndex: 0,
      chainId: 84532,
      grossUnits: "100000000",
      feeUnits: "20000000",
      grossUsdc: "100",
      feeUsdc: "20",
    });
  });

  it("rejects a fee larger than gross", () => {
    expect(() => toTreasuryFeeReceiptRow(log({ platformFee: BigInt(200000000) }), 84532)).toThrow();
  });

  it("rejects negative amounts and bad log index", () => {
    expect(() => toTreasuryFeeReceiptRow(log({ grossAmount: BigInt(-1) }), 84532)).toThrow();
    expect(() => toTreasuryFeeReceiptRow(log({ logIndex: -1 }), 84532)).toThrow();
  });
});

describe("buildTreasuryFeeReceiptRows", () => {
  it("dedupes by (txHash, logIndex) so re-scans are idempotent", () => {
    const rows = buildTreasuryFeeReceiptRows(
      [
        log({ txHash: "0xaa", logIndex: 0 }),
        log({ txHash: "0xaa", logIndex: 0 }), // duplicate
        log({ txHash: "0xaa", logIndex: 1 }),
        log({ txHash: "0xbb", logIndex: 0 }),
      ],
      84532,
    );
    expect(rows).toHaveLength(3);
  });

  it("sums fee units across rows", () => {
    const rows = buildTreasuryFeeReceiptRows(
      [log({ txHash: "0xaa", logIndex: 0 }), log({ txHash: "0xbb", logIndex: 0 })],
      84532,
    );
    expect(sumFeeUnits(rows)).toBe(BigInt(40000000));
  });
});

describe("reconcileTreasury", () => {
  it("reports matched when recorded fees equal chain event fees", () => {
    const result = reconcileTreasury({
      recordedFeeUnits: BigInt(40000000),
      chainEventFeeUnits: BigInt(40000000),
      treasuryBalanceUnits: BigInt(40000000),
    });
    expect(result.indexStatus).toBe("matched");
    expect(result.indexDeltaUsdc).toBe("0");
    expect(result.balanceStatus).toBe("ok");
    expect(result.recordedFeeUsdc).toBe("40");
  });

  it("reports mismatch and signed delta when the indexer drifts", () => {
    const result = reconcileTreasury({
      recordedFeeUnits: BigInt(30000000),
      chainEventFeeUnits: BigInt(40000000),
    });
    expect(result.indexStatus).toBe("mismatch");
    expect(result.indexDeltaUsdc).toBe("-10");
    expect(result.balanceStatus).toBe("unknown");
    expect(result.treasuryBalanceUsdc).toBeNull();
  });

  it("flags treasury balance below cumulative fees", () => {
    const result = reconcileTreasury({
      recordedFeeUnits: BigInt(40000000),
      chainEventFeeUnits: BigInt(40000000),
      treasuryBalanceUnits: BigInt(10000000),
    });
    expect(result.balanceStatus).toBe("below_fees");
  });
});

describe("nextScanFromBlock", () => {
  it("starts from the deploy block when never indexed", () => {
    expect(nextScanFromBlock(null, BigInt(500))).toBe(BigInt(500));
  });

  it("re-scans the last indexed block to tolerate reorgs", () => {
    expect(nextScanFromBlock(BigInt(1200), BigInt(500))).toBe(BigInt(1200));
  });

  it("never scans before the deploy block", () => {
    expect(nextScanFromBlock(BigInt(100), BigInt(500))).toBe(BigInt(500));
  });
});
