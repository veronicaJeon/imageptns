import { normalizeProofStatus } from "./registration";

export type FeeOrderStatus = "pending" | "paid" | "failed" | "canceled" | "refunded";

export interface FeeEligibleImageInput {
  id: string;
  status: string | null;
  salesCount: number | null | undefined;
  proofStatus: string | null | undefined;
  proofRequestPaymentStatus?: string | null | undefined;
}

export interface RegistrationFeeAmount {
  unitFeeKrw: number;
  count: number;
  amountKrw: number;
}

/**
 * A pre-sale image is eligible for a photographer-funded Arweave registration fee
 * when it is approved, has no sales yet, is not already in an active proof state,
 * and has no in-flight (pending/paid) fee payment.
 */
export function isSelfFundedFeeEligible(input: FeeEligibleImageInput): boolean {
  if (input.status !== "approved") return false;
  if ((input.salesCount ?? 0) > 0) return false;

  const proofStatus = normalizeProofStatus(input.proofStatus);
  if (!["not_registered", "available"].includes(proofStatus)) return false;

  const paymentStatus = input.proofRequestPaymentStatus ?? "none";
  return paymentStatus === "none" || paymentStatus === "refunded";
}

export function filterSelfFundedFeeEligible(items: FeeEligibleImageInput[]): string[] {
  return items.filter(isSelfFundedFeeEligible).map((item) => item.id);
}

export function computeRegistrationFeeAmount(
  unitFeeKrw: number,
  count: number,
): RegistrationFeeAmount {
  const safeUnit = Number.isFinite(unitFeeKrw) && unitFeeKrw > 0 ? Math.round(unitFeeKrw) : 0;
  const safeCount = Number.isInteger(count) && count > 0 ? count : 0;
  return {
    unitFeeKrw: safeUnit,
    count: safeCount,
    amountKrw: safeUnit * safeCount,
  };
}

/** Pending orders can be canceled (no charge captured yet). */
export function canCancelFeeOrder(status: string | null | undefined): boolean {
  return status === "pending";
}

/** Paid orders can be refunded (charge must be reversed via the provider). */
export function canRefundFeeOrder(status: string | null | undefined): boolean {
  return status === "paid";
}

export function feeOrderName(count: number): string {
  return count === 1
    ? "Arweave 셀프등록 수수료"
    : `Arweave 셀프등록 수수료 외 ${count - 1}건`;
}
