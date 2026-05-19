import { getAddress } from "viem";
import { bigintToDecimalString } from "./amounts";
import { USDC_DECIMALS } from "./chains";

interface ClaimablePhotographerJoin {
  wallet_address: string | null;
}

export interface ClaimableLedgerReconciliationRow {
  photographer_id: string;
  claimable_amount: number | string | null;
  photographer: ClaimablePhotographerJoin | ClaimablePhotographerJoin[] | null;
}

export interface ClaimablePhotographerAggregate {
  photographerId: string;
  walletAddress: string | null;
  rowCount: number;
  dbClaimableUnits: bigint;
  dbClaimableUsdc: string;
}

export type ClaimableComparisonStatus = "matched" | "mismatch";

function decimalToUnits(value: number | string, decimals = USDC_DECIMALS) {
  const normalized = String(value).trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) throw new Error("Invalid decimal amount");

  const [whole, fraction = ""] = normalized.split(".");
  if (fraction.length > decimals && /[1-9]/.test(fraction.slice(decimals))) {
    throw new Error("Invalid decimal amount");
  }
  const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(`${whole}${paddedFraction}`.replace(/^0+/, "") || "0");
}

function joinedPhotographerWallet(photographer: ClaimableLedgerReconciliationRow["photographer"]) {
  const row = Array.isArray(photographer) ? photographer[0] : photographer;
  if (!row?.wallet_address) return null;

  try {
    return getAddress(row.wallet_address);
  } catch {
    return null;
  }
}

export function aggregateClaimableByPhotographer(
  rows: ClaimableLedgerReconciliationRow[],
): ClaimablePhotographerAggregate[] {
  const aggregates = new Map<string, ClaimablePhotographerAggregate>();

  for (const row of rows) {
    const walletAddress = joinedPhotographerWallet(row.photographer);
    const current = aggregates.get(row.photographer_id) ?? {
      photographerId: row.photographer_id,
      walletAddress,
      rowCount: 0,
      dbClaimableUnits: BigInt(0),
      dbClaimableUsdc: "0",
    };

    current.rowCount += 1;
    current.dbClaimableUnits += decimalToUnits(row.claimable_amount ?? "0");
    current.dbClaimableUsdc = bigintToDecimalString(current.dbClaimableUnits, USDC_DECIMALS);
    if (!current.walletAddress && walletAddress) current.walletAddress = walletAddress;
    aggregates.set(row.photographer_id, current);
  }

  return [...aggregates.values()];
}

export function compareClaimableAmounts(dbClaimableUnits: bigint, contractClaimableUnits: bigint) {
  const deltaUnits = dbClaimableUnits - contractClaimableUnits;
  return {
    status: deltaUnits === BigInt(0) ? "matched" as const : "mismatch" as const,
    deltaUnits,
    deltaUsdc: bigintToDecimalString(deltaUnits, USDC_DECIMALS),
  };
}
