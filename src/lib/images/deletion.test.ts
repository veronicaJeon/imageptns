import { describe, expect, it } from "vitest";
import {
  assessImageDeletion,
  defaultDeletionFeeKrw,
  deletionImpactMessage,
} from "./deletion";

describe("image deletion policy", () => {
  it("allows unsold and unregistered images to be purged", () => {
    const impact = assessImageDeletion({
      sales_count: 0,
      proof_status: "not_registered",
      proof_tx_hash: null,
      proof_arweave_original_tx_id: null,
      proof_arweave_manifest_tx_id: null,
    }, { requesterRole: "admin" });

    expect(impact.action).toBe("purge");
    expect(impact.lifecycleStatus).toBe("purged");
    expect(impact.buyerNoticeRequired).toBe(false);
    expect(impact.estimatedFeeKrw).toBe(0);
  });

  it("archives sold images and requires buyer notices", () => {
    const impact = assessImageDeletion({
      sales_count: 3,
      proof_status: "available",
      proof_tx_hash: null,
      proof_arweave_original_tx_id: null,
      proof_arweave_manifest_tx_id: null,
    }, { requesterRole: "admin" });

    expect(impact.action).toBe("archive");
    expect(impact.lifecycleStatus).toBe("archived");
    expect(impact.buyerNoticeRequired).toBe(true);
    expect(deletionImpactMessage(impact)).toContain("구매 이력");
  });

  it("archives onchain or Arweave registered images even when sales count is missing", () => {
    const impact = assessImageDeletion({
      sales_count: null,
      proof_status: "registered",
      proof_tx_hash: "0xabc",
      proof_arweave_original_tx_id: "ar-tx",
      proof_arweave_manifest_tx_id: null,
    }, { requesterRole: "admin" });

    expect(impact.action).toBe("archive");
    expect(impact.onchainNoticeRequired).toBe(true);
    expect(impact.reasons).toContain("onchain_registered");
  });

  it("charges a higher default fee for photographer requests that affect buyers or onchain records", () => {
    const simple = assessImageDeletion({
      sales_count: 0,
      proof_status: "not_registered",
      proof_tx_hash: null,
      proof_arweave_original_tx_id: null,
      proof_arweave_manifest_tx_id: null,
    }, { requesterRole: "photographer" });

    const complex = assessImageDeletion({
      sales_count: 1,
      proof_status: "registered",
      proof_tx_hash: "0xabc",
      proof_arweave_original_tx_id: "ar-tx",
      proof_arweave_manifest_tx_id: "manifest",
    }, { requesterRole: "photographer" });

    expect(defaultDeletionFeeKrw(simple)).toBe(5000);
    expect(defaultDeletionFeeKrw(complex)).toBe(30000);
    expect(complex.estimatedFeeKrw).toBe(30000);
  });
});
