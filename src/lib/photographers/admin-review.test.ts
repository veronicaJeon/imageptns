import { describe, expect, it } from "vitest";
import { buildPhotographerApplicationReviewUpdate } from "./admin-review";

describe("photographer application admin review", () => {
  it("builds an approval update that clears rejection state", () => {
    expect(
      buildPhotographerApplicationReviewUpdate({
        action: "approve",
        reviewerId: "admin-1",
        reviewedAt: "2026-07-06T00:00:00.000Z",
        adminNote: "  통화 완료  ",
      })
    ).toEqual({
      status: "approved",
      reviewed_by: "admin-1",
      reviewed_at: "2026-07-06T00:00:00.000Z",
      rejection_reason: null,
      admin_note: "통화 완료",
    });
  });

  it("requires a rejection reason when rejecting", () => {
    expect(() =>
      buildPhotographerApplicationReviewUpdate({
        action: "reject",
        reviewerId: "admin-1",
        reviewedAt: "2026-07-06T00:00:00.000Z",
        rejectionReason: " ",
      })
    ).toThrow("rejection_reason");
  });

  it("builds a rejection update with trimmed reason and note", () => {
    expect(
      buildPhotographerApplicationReviewUpdate({
        action: "reject",
        reviewerId: "admin-1",
        reviewedAt: "2026-07-06T00:00:00.000Z",
        rejectionReason: "  활동 정보를 확인할 수 없음  ",
        adminNote: "  재신청 가능  ",
      })
    ).toEqual({
      status: "rejected",
      reviewed_by: "admin-1",
      reviewed_at: "2026-07-06T00:00:00.000Z",
      rejection_reason: "활동 정보를 확인할 수 없음",
      admin_note: "재신청 가능",
    });
  });
});
