export type PayoutAction = "approve" | "reject";

// 지급 완료·반려·실패된 정산은 다시 처리하지 않는다. 중복 승인 시 지급일 덮어쓰기와 메일 재발송을 막는다.
export const PAYOUT_ACTIONABLE_STATUSES = ["pending", "processing"] as const;

export function isPayoutAction(value: unknown): value is PayoutAction {
  return value === "approve" || value === "reject";
}

export function isPayoutActionable(status: string | null | undefined) {
  return (PAYOUT_ACTIONABLE_STATUSES as readonly string[]).includes(status ?? "");
}

export function payoutActionUpdates(action: PayoutAction, note: string | null, now: Date) {
  return action === "approve"
    ? { status: "paid", paid_at: now.toISOString(), note }
    : { status: "rejected", note };
}

export function payoutAuditAction(action: PayoutAction) {
  return action === "approve" ? "payout.approved" : "payout.rejected";
}

export function normalizePayoutNote(value: unknown) {
  if (typeof value !== "string") return null;
  const note = value.trim().slice(0, 1000);
  return note || null;
}
