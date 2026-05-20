import { describe, expect, it } from "vitest";
import { assessProfileWithdrawal } from "./withdrawal";

describe("assessProfileWithdrawal", () => {
  it("allows an empty photographer profile to be deleted immediately", () => {
    const assessment = assessProfileWithdrawal({});

    expect(assessment.canDeleteImmediately).toBe(true);
    expect(assessment.blockingReasons).toEqual([]);
    expect(assessment.requiredActions).toEqual([]);
    expect(assessment.impactSnapshot).toEqual({
      activeImages: 0,
      soldImages: 0,
      onchainImages: 0,
      pendingOrders: 0,
      pendingPayouts: 0,
      claimableEarnings: 0,
      claimableAmount: 0,
    });
  });

  it("blocks withdrawal when a photographer has sold images", () => {
    const assessment = assessProfileWithdrawal({ soldImages: 2 });

    expect(assessment.canDeleteImmediately).toBe(false);
    expect(assessment.blockingReasons.map((reason) => reason.code)).toContain("sold_images");
    expect(assessment.requiredActions.map((action) => action.code)).toContain("preserve_sold_image_access");
  });

  it("blocks withdrawal when a photographer has onchain or Arweave images", () => {
    const assessment = assessProfileWithdrawal({ onchainImages: 1 });

    expect(assessment.canDeleteImmediately).toBe(false);
    expect(assessment.blockingReasons.map((reason) => reason.code)).toContain("onchain_images");
    expect(assessment.requiredActions.map((action) => action.code)).toContain("review_onchain_records");
  });

  it("blocks withdrawal when a photographer has pending orders", () => {
    const assessment = assessProfileWithdrawal({ pendingOrders: 3 });

    expect(assessment.canDeleteImmediately).toBe(false);
    expect(assessment.blockingReasons.map((reason) => reason.code)).toContain("pending_orders");
    expect(assessment.requiredActions.map((action) => action.code)).toContain("resolve_pending_orders");
  });

  it("blocks withdrawal when a photographer has pending payouts", () => {
    const assessment = assessProfileWithdrawal({ pendingPayouts: 1 });

    expect(assessment.canDeleteImmediately).toBe(false);
    expect(assessment.blockingReasons.map((reason) => reason.code)).toContain("pending_payouts");
    expect(assessment.requiredActions.map((action) => action.code)).toContain("settle_pending_payouts");
  });

  it("blocks withdrawal when a photographer has claimable earnings", () => {
    const assessment = assessProfileWithdrawal({
      claimableEarnings: 2,
      claimableAmount: "3.75",
    });

    expect(assessment.canDeleteImmediately).toBe(false);
    expect(assessment.impactSnapshot.claimableAmount).toBe(3.75);
    expect(assessment.blockingReasons.map((reason) => reason.code)).toContain("claimable_earnings");
    expect(assessment.requiredActions.map((action) => action.code)).toContain("settle_claimable_earnings");
  });
});
