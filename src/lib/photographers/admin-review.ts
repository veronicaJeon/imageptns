export type PhotographerApplicationReviewAction = "approve" | "reject";

export interface PhotographerApplicationReviewInput {
  action: unknown;
  reviewerId: string;
  reviewedAt: string;
  rejectionReason?: unknown;
  adminNote?: unknown;
}

export interface PhotographerApplicationReviewUpdate {
  status: "approved" | "rejected";
  reviewed_by: string;
  reviewed_at: string;
  rejection_reason: string | null;
  admin_note: string | null;
}

function cleanOptionalText(value: unknown, fieldName: string, maxLength: number) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error(`${fieldName} must be a string`);

  const text = value.trim().replace(/\s+/g, " ");
  if (!text) return null;
  if (text.length > maxLength) throw new Error(`${fieldName} must be ${maxLength} characters or fewer`);
  return text;
}

export function normalizePhotographerApplicationReviewAction(value: unknown): PhotographerApplicationReviewAction {
  if (value === "approve" || value === "reject") return value;
  throw new Error("action must be approve or reject");
}

export function buildPhotographerApplicationReviewUpdate(
  input: PhotographerApplicationReviewInput
): PhotographerApplicationReviewUpdate {
  const action = normalizePhotographerApplicationReviewAction(input.action);
  const adminNote = cleanOptionalText(input.adminNote, "admin_note", 1000);

  if (action === "approve") {
    return {
      status: "approved",
      reviewed_by: input.reviewerId,
      reviewed_at: input.reviewedAt,
      rejection_reason: null,
      admin_note: adminNote,
    };
  }

  const rejectionReason = cleanOptionalText(input.rejectionReason, "rejection_reason", 1000);
  if (!rejectionReason) throw new Error("rejection_reason required");

  return {
    status: "rejected",
    reviewed_by: input.reviewerId,
    reviewed_at: input.reviewedAt,
    rejection_reason: rejectionReason,
    admin_note: adminNote,
  };
}
