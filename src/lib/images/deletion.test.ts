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

  it("charges photographer deletion fees only for Arweave credentials", () => {
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

    expect(defaultDeletionFeeKrw(simple)).toBe(0);
    expect(defaultDeletionFeeKrw(complex)).toBe(30000);
    expect(complex.estimatedFeeKrw).toBe(30000);
  });

  it("recognizes a confirmed Arweave credential even when transaction ids are absent", () => {
    const impact = assessImageDeletion({
      sales_count: 0,
      proof_status: "not_registered",
      proof_arweave_confirmed_at: "2026-07-22T00:00:00.000Z",
    }, { requesterRole: "photographer" });

    expect(impact.reasons).toContain("arweave_registered");
    expect(impact.estimatedFeeKrw).toBe(30000);
  });

  it("uses administrator-configured photographer deletion fees", () => {
    const simple = assessImageDeletion({
      sales_count: 0,
      proof_status: "not_registered",
      proof_tx_hash: null,
      proof_arweave_original_tx_id: null,
      proof_arweave_manifest_tx_id: null,
    }, {
      requesterRole: "photographer",
      feeConfig: { simpleFeeKrw: 7000, complexFeeKrw: 45000 },
    });

    const complex = assessImageDeletion({
      sales_count: 2,
      proof_status: "registered",
      proof_tx_hash: "0xabc",
      proof_arweave_original_tx_id: "arweave-original",
      proof_arweave_manifest_tx_id: null,
    }, {
      requesterRole: "photographer",
      feeConfig: { simpleFeeKrw: 7000, complexFeeKrw: 45000 },
    });

    expect(simple.estimatedFeeKrw).toBe(0);
    expect(complex.estimatedFeeKrw).toBe(45000);
    expect(defaultDeletionFeeKrw(complex, { simpleFeeKrw: 7000, complexFeeKrw: 45000 })).toBe(45000);
  });
});
