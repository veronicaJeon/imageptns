import { describe, expect, it } from "vitest";
import {
  adminCanReviewImage,
  buyerCanViewImage,
  ownerUploadBucket,
} from "./state-visibility";

const NOW = Date.parse("2026-07-29T12:00:00.000Z");

describe("image state visibility matrix", () => {
  it("shows new uploads to the owner and review queue, but not buyers", () => {
    const image = { status: "pending", lifecycle_status: "active", is_published: false };
    expect(ownerUploadBucket(image, { rejectedRetentionDays: 7, now: NOW })).toBe("pending");
    expect(adminCanReviewImage(image)).toBe(true);
    expect(buyerCanViewImage(image)).toBe(false);
  });

  it("shows only approved, active, published images to buyers", () => {
    expect(buyerCanViewImage({ status: "approved", lifecycle_status: "active", is_published: true })).toBe(true);
    expect(buyerCanViewImage({ status: "approved", lifecycle_status: "active", is_published: false })).toBe(false);
    expect(buyerCanViewImage({ status: "approved", lifecycle_status: "deletion_requested", is_published: true })).toBe(false);
    expect(buyerCanViewImage({ status: "rejected", lifecycle_status: "active", is_published: true })).toBe(false);
  });

  it("groups approved unpublished images under the owner removed tab", () => {
    const image = { status: "approved", lifecycle_status: "active", is_published: false };
    expect(ownerUploadBucket(image, { rejectedRetentionDays: 7, now: NOW })).toBe("removed");
    expect(buyerCanViewImage(image)).toBe(false);
  });

  it("keeps deletion states in the owner history but out of review and buyer views", () => {
    for (const lifecycle_status of ["deletion_requested", "archived", "purged", "legal_hold"]) {
      const image = { status: "approved", lifecycle_status, is_published: false };
      expect(ownerUploadBucket(image, { rejectedRetentionDays: 7, now: NOW })).toBe("removed");
      expect(adminCanReviewImage(image)).toBe(false);
      expect(buyerCanViewImage(image)).toBe(false);
    }
  });

  it("expires rejected records only under the rejected-retention policy", () => {
    expect(ownerUploadBucket({
      status: "rejected",
      lifecycle_status: "active",
      rejected_at: "2026-07-25T12:00:00.000Z",
    }, { rejectedRetentionDays: 7, now: NOW })).toBe("rejected");

    expect(ownerUploadBucket({
      status: "rejected",
      lifecycle_status: "active",
      rejected_at: "2026-07-20T12:00:00.000Z",
    }, { rejectedRetentionDays: 7, now: NOW })).toBeNull();

    expect(ownerUploadBucket({
      status: "rejected",
      lifecycle_status: "archived",
      unpublished_reason: "Rejected image retention expired",
    }, { rejectedRetentionDays: 7, now: NOW })).toBeNull();

    expect(ownerUploadBucket({
      status: "rejected",
      lifecycle_status: "purged",
      unpublished_reason: "관리자 삭제",
    }, { rejectedRetentionDays: 7, now: NOW })).toBe("removed");
  });
});
