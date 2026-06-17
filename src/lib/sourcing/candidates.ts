export interface CandidateImageState {
  status: string | null;
  lifecycle_status: string | null;
  is_published?: boolean | null;
}

export type CandidateIneligibleReason =
  | "image_not_approved"
  | "image_not_active"
  | "image_not_published";

export function candidateImageEligibility(image: CandidateImageState): {
  eligible: boolean;
  reason: CandidateIneligibleReason | null;
} {
  if (image.status !== "approved") return { eligible: false, reason: "image_not_approved" };
  if ((image.lifecycle_status ?? "active") !== "active") return { eligible: false, reason: "image_not_active" };
  if (image.is_published === false) return { eligible: false, reason: "image_not_published" };
  return { eligible: true, reason: null };
}

export function canPublishCandidate(image: CandidateImageState) {
  return candidateImageEligibility(image).eligible;
}
