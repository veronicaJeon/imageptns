export type OwnerUploadBucket = "pending" | "approved" | "rejected" | "removed";

export interface ImageVisibilityState {
  status?: string | null;
  lifecycle_status?: string | null;
  is_published?: boolean | null;
  created_at?: string | null;
  rejected_at?: string | null;
  unpublished_reason?: string | null;
}

const COMPLETED_REMOVAL_STATES = new Set(["archived", "purged"]);
const NON_ACTIVE_STATES = new Set(["deletion_requested", "archived", "purged", "legal_hold"]);

function lifecycle(state: ImageVisibilityState) {
  return state.lifecycle_status?.trim() || "active";
}

export function isCompletedImageRemoval(state: ImageVisibilityState) {
  return COMPLETED_REMOVAL_STATES.has(lifecycle(state));
}

export function isImageLifecycleActive(state: ImageVisibilityState) {
  return lifecycle(state) === "active";
}

export function ownerUploadBucket(
  state: ImageVisibilityState,
  options: { rejectedRetentionDays: number; now?: number },
): OwnerUploadBucket | null {
  const currentLifecycle = lifecycle(state);

  // The retention job archives old rejections specifically so their record
  // disappears from the photographer UI. Other removal records remain visible
  // until an administrator performs a physical database deletion.
  if (
    currentLifecycle === "archived" &&
    state.status === "rejected" &&
    state.unpublished_reason === "Rejected image retention expired"
  ) {
    return null;
  }

  if (NON_ACTIVE_STATES.has(currentLifecycle)) return "removed";

  if (state.status === "rejected") {
    const retentionMs = Math.max(1, options.rejectedRetentionDays) * 24 * 60 * 60 * 1000;
    const rejectedAt = new Date(state.rejected_at ?? state.created_at ?? 0).getTime();
    const now = options.now ?? Date.now();
    return Number.isFinite(rejectedAt) && rejectedAt >= now - retentionMs ? "rejected" : null;
  }

  if (state.status === "approved") return "approved";
  return "pending";
}

export function buyerCanViewImage(state: ImageVisibilityState) {
  return state.status === "approved" && isImageLifecycleActive(state) && state.is_published === true;
}

export function adminCanReviewImage(state: ImageVisibilityState) {
  return state.status === "pending" && isImageLifecycleActive(state);
}
