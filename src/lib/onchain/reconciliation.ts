export const ONCHAIN_PENDING_STALE_MINUTES = 30;

export function getOnchainPendingAgeMinutes(createdAt: string, now = new Date()) {
  const createdMs = Date.parse(createdAt);
  if (!Number.isFinite(createdMs)) return 0;
  const elapsedMs = now.getTime() - createdMs;
  if (elapsedMs <= 0) return 0;
  return Math.floor(elapsedMs / 60_000);
}

export function isStaleOnchainPendingOrder(
  createdAt: string,
  now = new Date(),
  staleMinutes = ONCHAIN_PENDING_STALE_MINUTES,
) {
  return getOnchainPendingAgeMinutes(createdAt, now) >= staleMinutes;
}

export interface CancelableOrderInput {
  paymentProvider: string | null;
  status: string;
  cryptoStatus: string;
  paymentTxHash: string | null;
}

export type CancelPendingDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Whether an admin may manually cancel a pending onchain order. Only
 * never-paid, still-pending Base USDC orders qualify; any order with a
 * detected purchase tx is protected from cancellation.
 */
export function canCancelPendingOnchainOrder(order: CancelableOrderInput): CancelPendingDecision {
  if (order.paymentProvider !== "base_usdc") {
    return { allowed: false, reason: "Base USDC 주문만 취소할 수 있습니다." };
  }
  if (order.paymentTxHash) {
    return { allowed: false, reason: "구매 트랜잭션이 감지된 주문은 취소할 수 없습니다." };
  }
  if (order.status !== "pending" || order.cryptoStatus !== "pending") {
    return { allowed: false, reason: "결제 대기(pending) 상태의 주문만 취소할 수 있습니다." };
  }
  return { allowed: true };
}
