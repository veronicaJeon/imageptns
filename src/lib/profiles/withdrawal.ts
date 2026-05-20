export type ProfileWithdrawalReasonCode =
  | "active_images"
  | "sold_images"
  | "onchain_images"
  | "pending_orders"
  | "pending_payouts"
  | "claimable_earnings";

export type ProfileWithdrawalActionCode =
  | "retire_active_images"
  | "preserve_sold_image_access"
  | "review_onchain_records"
  | "resolve_pending_orders"
  | "settle_pending_payouts"
  | "settle_claimable_earnings";

export interface ProfileWithdrawalImpactInput {
  activeImages?: number | string | null;
  soldImages?: number | string | null;
  onchainImages?: number | string | null;
  pendingOrders?: number | string | null;
  pendingPayouts?: number | string | null;
  claimableEarnings?: number | string | null;
  claimableAmount?: number | string | null;
}

export interface ProfileWithdrawalImpactSnapshot {
  activeImages: number;
  soldImages: number;
  onchainImages: number;
  pendingOrders: number;
  pendingPayouts: number;
  claimableEarnings: number;
  claimableAmount: number;
}

export interface ProfileWithdrawalBlockingReason {
  code: ProfileWithdrawalReasonCode;
  label: string;
  count: number;
  amount?: number;
}

export interface ProfileWithdrawalRequiredAction {
  code: ProfileWithdrawalActionCode;
  label: string;
  description: string;
}

export interface ProfileWithdrawalAssessment {
  canDeleteImmediately: boolean;
  blockingReasons: ProfileWithdrawalBlockingReason[];
  requiredActions: ProfileWithdrawalRequiredAction[];
  impactSnapshot: ProfileWithdrawalImpactSnapshot;
}

const ACTIONS: Record<ProfileWithdrawalActionCode, ProfileWithdrawalRequiredAction> = {
  retire_active_images: {
    code: "retire_active_images",
    label: "Retire active images",
    description: "Archive, transfer, or remove active portfolio images before the profile is withdrawn.",
  },
  preserve_sold_image_access: {
    code: "preserve_sold_image_access",
    label: "Preserve sold image access",
    description: "Keep buyer order history and licensed image access intact before profile withdrawal.",
  },
  review_onchain_records: {
    code: "review_onchain_records",
    label: "Review onchain records",
    description: "Review Base or Arweave proof records that cannot be erased with a profile withdrawal.",
  },
  resolve_pending_orders: {
    code: "resolve_pending_orders",
    label: "Resolve pending orders",
    description: "Complete, fail, or refund pending orders that include this photographer's images.",
  },
  settle_pending_payouts: {
    code: "settle_pending_payouts",
    label: "Settle pending payouts",
    description: "Finish pending or processing payouts before profile withdrawal.",
  },
  settle_claimable_earnings: {
    code: "settle_claimable_earnings",
    label: "Settle claimable earnings",
    description: "Claim, reconcile, or mark claimable onchain earnings before profile withdrawal.",
  },
};

function toCount(value: number | string | null | undefined) {
  const count = Number(value ?? 0);
  return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
}

function toAmount(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

function reason(
  code: ProfileWithdrawalReasonCode,
  label: string,
  count: number,
  amount?: number,
): ProfileWithdrawalBlockingReason {
  return amount === undefined ? { code, label, count } : { code, label, count, amount };
}

export function assessProfileWithdrawal(
  input: ProfileWithdrawalImpactInput = {},
): ProfileWithdrawalAssessment {
  const impactSnapshot: ProfileWithdrawalImpactSnapshot = {
    activeImages: toCount(input.activeImages),
    soldImages: toCount(input.soldImages),
    onchainImages: toCount(input.onchainImages),
    pendingOrders: toCount(input.pendingOrders),
    pendingPayouts: toCount(input.pendingPayouts),
    claimableEarnings: toCount(input.claimableEarnings),
    claimableAmount: toAmount(input.claimableAmount),
  };

  const blockingReasons: ProfileWithdrawalBlockingReason[] = [];
  const requiredActions: ProfileWithdrawalRequiredAction[] = [];

  if (impactSnapshot.activeImages > 0) {
    blockingReasons.push(reason("active_images", "Active images", impactSnapshot.activeImages));
    requiredActions.push(ACTIONS.retire_active_images);
  }

  if (impactSnapshot.soldImages > 0) {
    blockingReasons.push(reason("sold_images", "Sold images", impactSnapshot.soldImages));
    requiredActions.push(ACTIONS.preserve_sold_image_access);
  }

  if (impactSnapshot.onchainImages > 0) {
    blockingReasons.push(reason("onchain_images", "Onchain or Arweave images", impactSnapshot.onchainImages));
    requiredActions.push(ACTIONS.review_onchain_records);
  }

  if (impactSnapshot.pendingOrders > 0) {
    blockingReasons.push(reason("pending_orders", "Pending orders", impactSnapshot.pendingOrders));
    requiredActions.push(ACTIONS.resolve_pending_orders);
  }

  if (impactSnapshot.pendingPayouts > 0) {
    blockingReasons.push(reason("pending_payouts", "Pending payouts", impactSnapshot.pendingPayouts));
    requiredActions.push(ACTIONS.settle_pending_payouts);
  }

  if (impactSnapshot.claimableEarnings > 0 || impactSnapshot.claimableAmount > 0) {
    blockingReasons.push(reason(
      "claimable_earnings",
      "Claimable earnings",
      impactSnapshot.claimableEarnings,
      impactSnapshot.claimableAmount,
    ));
    requiredActions.push(ACTIONS.settle_claimable_earnings);
  }

  return {
    canDeleteImmediately: blockingReasons.length === 0,
    blockingReasons,
    requiredActions,
    impactSnapshot,
  };
}
