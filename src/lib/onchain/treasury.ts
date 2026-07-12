import { getAddress } from "viem";
import { bigintToDecimalString } from "./amounts";
import { USDC_DECIMALS } from "./chains";

/**
 * A decoded `PurchaseCompleted(orderId, buyer, grossAmount, platformFee)`
 * event together with the on-chain location of the emitting log. Used to
 * build durable treasury fee receipts from indexed escrow events.
 */
export interface PurchaseCompletedLog {
  orderId: string;
  buyer: string;
  grossAmount: bigint;
  platformFee: bigint;
  txHash: string;
  blockNumber: bigint;
  logIndex: number;
}

/**
 * Normalized treasury fee receipt row. One row per indexed PurchaseCompleted
 * event. `(txHash, logIndex)` is the natural idempotency key.
 */
export interface TreasuryFeeReceiptRow {
  contractOrderId: string;
  buyerAddress: string;
  txHash: string;
  blockNumber: number;
  logIndex: number;
  chainId: number;
  grossUnits: string;
  feeUnits: string;
  grossUsdc: string;
  feeUsdc: string;
}

function normalizeTxHash(txHash: string): string {
  return txHash.trim().toLowerCase();
}

export function toTreasuryFeeReceiptRow(
  log: PurchaseCompletedLog,
  chainId: number,
  decimals = USDC_DECIMALS,
): TreasuryFeeReceiptRow {
  if (log.grossAmount < BigInt(0) || log.platformFee < BigInt(0)) {
    throw new Error("PurchaseCompleted amounts must be non-negative");
  }
  if (log.platformFee > log.grossAmount) {
    throw new Error("platformFee cannot exceed grossAmount");
  }
  if (log.logIndex < 0 || !Number.isInteger(log.logIndex)) {
    throw new Error("logIndex must be a non-negative integer");
  }

  return {
    contractOrderId: log.orderId.trim().toLowerCase(),
    buyerAddress: getAddress(log.buyer),
    txHash: normalizeTxHash(log.txHash),
    blockNumber: Number(log.blockNumber),
    logIndex: log.logIndex,
    chainId,
    grossUnits: log.grossAmount.toString(),
    feeUnits: log.platformFee.toString(),
    grossUsdc: bigintToDecimalString(log.grossAmount, decimals),
    feeUsdc: bigintToDecimalString(log.platformFee, decimals),
  };
}

/**
 * Build deduped, normalized receipt rows from raw decoded logs. Later logs
 * sharing the same `(txHash, logIndex)` are ignored so a re-scan over an
 * overlapping block range is idempotent.
 */
export function buildTreasuryFeeReceiptRows(
  logs: PurchaseCompletedLog[],
  chainId: number,
  decimals = USDC_DECIMALS,
): TreasuryFeeReceiptRow[] {
  const seen = new Set<string>();
  const rows: TreasuryFeeReceiptRow[] = [];

  for (const log of logs) {
    const row = toTreasuryFeeReceiptRow(log, chainId, decimals);
    const key = `${row.txHash}:${row.logIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }

  return rows;
}

function sumUnits(values: Array<string | bigint>): bigint {
  return values.reduce<bigint>((total, value) => total + BigInt(value), BigInt(0));
}

export function sumFeeUnits(rows: Array<{ feeUnits: string | bigint }>): bigint {
  return sumUnits(rows.map((row) => row.feeUnits));
}

export type TreasuryIndexStatus = "matched" | "mismatch";
export type TreasuryBalanceStatus = "ok" | "below_fees" | "unknown";

export interface TreasuryReconciliation {
  recordedFeeUnits: string;
  recordedFeeUsdc: string;
  chainEventFeeUnits: string;
  chainEventFeeUsdc: string;
  indexStatus: TreasuryIndexStatus;
  indexDeltaUsdc: string;
  treasuryBalanceUnits: string | null;
  treasuryBalanceUsdc: string | null;
  balanceStatus: TreasuryBalanceStatus;
}

/**
 * Reconcile treasury accounting.
 *
 * - `indexStatus` compares fees recorded in our DB receipts against the sum of
 *   platformFee across on-chain PurchaseCompleted events. A mismatch means the
 *   indexer is incomplete or drifted — the primary integrity signal.
 * - `balanceStatus` is informational: the treasury wallet should hold at least
 *   the cumulative fees unless funds were intentionally swept out.
 */
export function reconcileTreasury(input: {
  recordedFeeUnits: bigint;
  chainEventFeeUnits: bigint;
  treasuryBalanceUnits?: bigint | null;
  decimals?: number;
}): TreasuryReconciliation {
  const decimals = input.decimals ?? USDC_DECIMALS;
  const indexDeltaUnits = input.recordedFeeUnits - input.chainEventFeeUnits;

  let balanceStatus: TreasuryBalanceStatus = "unknown";
  if (input.treasuryBalanceUnits !== undefined && input.treasuryBalanceUnits !== null) {
    balanceStatus = input.treasuryBalanceUnits >= input.chainEventFeeUnits ? "ok" : "below_fees";
  }

  return {
    recordedFeeUnits: input.recordedFeeUnits.toString(),
    recordedFeeUsdc: bigintToDecimalString(input.recordedFeeUnits, decimals),
    chainEventFeeUnits: input.chainEventFeeUnits.toString(),
    chainEventFeeUsdc: bigintToDecimalString(input.chainEventFeeUnits, decimals),
    indexStatus: indexDeltaUnits === BigInt(0) ? "matched" : "mismatch",
    indexDeltaUsdc: bigintToDecimalString(indexDeltaUnits, decimals),
    treasuryBalanceUnits:
      input.treasuryBalanceUnits !== undefined && input.treasuryBalanceUnits !== null
        ? input.treasuryBalanceUnits.toString()
        : null,
    treasuryBalanceUsdc:
      input.treasuryBalanceUnits !== undefined && input.treasuryBalanceUnits !== null
        ? bigintToDecimalString(input.treasuryBalanceUnits, decimals)
        : null,
    balanceStatus,
  };
}

/**
 * Compute the next `fromBlock` for an incremental scan given the last indexed
 * block. Re-scans the last block to tolerate reorgs/partial indexing; callers
 * dedupe via `(txHash, logIndex)`.
 */
export function nextScanFromBlock(lastIndexedBlock: bigint | null, deployBlock: bigint): bigint {
  if (lastIndexedBlock === null || lastIndexedBlock < deployBlock) return deployBlock;
  return lastIndexedBlock;
}
