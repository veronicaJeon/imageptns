import { describe, expect, it } from "vitest";
import {
  assessHardDeleteEligibility,
  assessPhotographerFinalDeleteEligibility,
  emptyImageReferenceCounts,
} from "./hard-delete";

const baseImage = {
  id: "img-1",
  title: "Test image",
  status: "pending",
  lifecycle_status: "active",
  is_published: false,
  sales_count: 0,
  proof_status: "not_registered",
  proof_tx_hash: null,
  proof_arweave_original_tx_id: null,
  proof_arweave_metadata_tx_id: null,
  proof_arweave_manifest_tx_id: null,
};

describe("assessHardDeleteEligibility", () => {
  it("allows unused active images with no proof records", () => {
    const result = assessHardDeleteEligibility(baseImage, emptyImageReferenceCounts());

    expect(result.allowed).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it("blocks sold or referenced images", () => {
    expect(assessHardDeleteEligibility({ ...baseImage, sales_count: 1 }, emptyImageReferenceCounts()).allowed).toBe(false);
    expect(assessHardDeleteEligibility(baseImage, { ...emptyImageReferenceCounts(), orderItems: 1 }).blockers).toContain("order_items");
    expect(assessHardDeleteEligibility(baseImage, { ...emptyImageReferenceCounts(), downloads: 1 }).blockers).toContain("downloads");
    expect(assessHardDeleteEligibility(baseImage, { ...emptyImageReferenceCounts(), earningsLedger: 1 }).blockers).toContain("earnings_ledger");
  });

  it("blocks onchain, Arweave, legal hold, archived, and deletion-requested images", () => {
    expect(assessHardDeleteEligibility({ ...baseImage, proof_status: "registered" }, emptyImageReferenceCounts()).blockers).toContain("onchain_or_arweave");
    expect(assessHardDeleteEligibility({ ...baseImage, proof_arweave_original_tx_id: "abc" }, emptyImageReferenceCounts()).blockers).toContain("onchain_or_arweave");
    expect(assessHardDeleteEligibility({ ...baseImage, lifecycle_status: "legal_hold" }, emptyImageReferenceCounts()).blockers).toContain("legal_hold");
    expect(assessHardDeleteEligibility({ ...baseImage, lifecycle_status: "archived" }, emptyImageReferenceCounts()).blockers).toContain("not_active");
    expect(assessHardDeleteEligibility(baseImage, { ...emptyImageReferenceCounts(), deletionRequests: 1 }).blockers).toContain("deletion_requests");
  });

  it("blocks operational workflow references", () => {
    expect(assessHardDeleteEligibility(baseImage, { ...emptyImageReferenceCounts(), sourcingResults: 1 }).blockers).toContain("sourcing_results");
    expect(assessHardDeleteEligibility(baseImage, { ...emptyImageReferenceCounts(), subscriptionDownloads: 1 }).blockers).toContain("subscription_downloads");
    expect(assessHardDeleteEligibility(baseImage, { ...emptyImageReferenceCounts(), arweaveFeeOrderItems: 1 }).blockers).toContain("arweave_fee_orders");
  });
});

describe("assessPhotographerFinalDeleteEligibility", () => {
  it("allows safe archived or unpublished approved images", () => {
    expect(assessPhotographerFinalDeleteEligibility({
      ...baseImage,
      lifecycle_status: "archived",
    }, emptyImageReferenceCounts()).allowed).toBe(true);

    expect(assessPhotographerFinalDeleteEligibility({
      ...baseImage,
      status: "approved",
      lifecycle_status: "active",
      is_published: false,
    }, emptyImageReferenceCounts()).allowed).toBe(true);
  });

  it("blocks active visible, deletion-requested, sold, referenced, and Arweave images", () => {
    expect(assessPhotographerFinalDeleteEligibility({
      ...baseImage,
      status: "approved",
      lifecycle_status: "active",
      is_published: true,
    }, emptyImageReferenceCounts()).blockers).toContain("not_hidden");
    expect(assessPhotographerFinalDeleteEligibility({
      ...baseImage,
      lifecycle_status: "deletion_requested",
    }, emptyImageReferenceCounts()).blockers).toContain("deletion_requested");
    expect(assessPhotographerFinalDeleteEligibility({
      ...baseImage,
      lifecycle_status: "archived",
      sales_count: 1,
    }, emptyImageReferenceCounts()).blockers).toContain("sales");
    expect(assessPhotographerFinalDeleteEligibility({
      ...baseImage,
      lifecycle_status: "archived",
      proof_arweave_original_tx_id: "abc",
    }, emptyImageReferenceCounts()).blockers).toContain("onchain_or_arweave");
    expect(assessPhotographerFinalDeleteEligibility({
      ...baseImage,
      lifecycle_status: "archived",
    }, { ...emptyImageReferenceCounts(), orderItems: 1 }).blockers).toContain("order_items");
  });
});
