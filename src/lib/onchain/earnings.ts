export type OnchainClaimFilter = "all" | "claimable" | "claimed";

export interface OnchainEarningLike {
  settlement_provider?: string | null;
  claim_status?: string | null;
  claimable_amount?: number | string | null;
}

export function filterOnchainEarnings<T extends OnchainEarningLike>(rows: T[], filter: OnchainClaimFilter) {
  return rows.filter((row) => {
    if (row.settlement_provider !== "onchain_escrow") return false;
    return filter === "all" || row.claim_status === filter;
  });
}

export function sumClaimableUsdc(rows: OnchainEarningLike[]) {
  return rows.reduce((sum, row) => sum + (Number(row.claimable_amount) || 0), 0);
}
