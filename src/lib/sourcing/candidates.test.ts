import { describe, expect, it } from "vitest";
import { candidateImageEligibility, canPublishCandidate } from "./candidates";

describe("candidate image eligibility", () => {
  it("allows only approved active published images", () => {
    expect(canPublishCandidate({ status: "approved", lifecycle_status: "active", is_published: true })).toBe(true);
    expect(canPublishCandidate({ status: "pending", lifecycle_status: "active", is_published: true })).toBe(false);
    expect(canPublishCandidate({ status: "approved", lifecycle_status: "archived", is_published: true })).toBe(false);
    expect(canPublishCandidate({ status: "approved", lifecycle_status: "active", is_published: false })).toBe(false);
  });

  it("returns buyer-safe reasons for ineligible images", () => {
    expect(candidateImageEligibility({ status: "approved", lifecycle_status: "active", is_published: false })).toEqual({
      eligible: false,
      reason: "image_not_published",
    });
  });
});
