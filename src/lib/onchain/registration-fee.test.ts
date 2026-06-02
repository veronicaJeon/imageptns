import { describe, expect, it } from "vitest";

import {
  canCancelFeeOrder,
  canRefundFeeOrder,
  computeRegistrationFeeAmount,
  feeOrderName,
  filterSelfFundedFeeEligible,
  isSelfFundedFeeEligible,
} from "./registration-fee";

describe("isSelfFundedFeeEligible", () => {
  it("accepts approved, unsold, not-registered images with no in-flight payment", () => {
    expect(
      isSelfFundedFeeEligible({
        id: "a",
        status: "approved",
        salesCount: 0,
        proofStatus: "not_registered",
        proofRequestPaymentStatus: "none",
      })
    ).toBe(true);
  });

  it("accepts refunded images so they can be re-requested", () => {
    expect(
      isSelfFundedFeeEligible({
        id: "a",
        status: "approved",
        salesCount: 0,
        proofStatus: "not_registered",
        proofRequestPaymentStatus: "refunded",
      })
    ).toBe(true);
  });

  it("rejects sold, unapproved, in-flight, or active-proof images", () => {
    expect(isSelfFundedFeeEligible({ id: "a", status: "approved", salesCount: 2, proofStatus: "not_registered" })).toBe(false);
    expect(isSelfFundedFeeEligible({ id: "a", status: "pending", salesCount: 0, proofStatus: "not_registered" })).toBe(false);
    expect(isSelfFundedFeeEligible({ id: "a", status: "approved", salesCount: 0, proofStatus: "requested" })).toBe(false);
    expect(isSelfFundedFeeEligible({ id: "a", status: "approved", salesCount: 0, proofStatus: "not_registered", proofRequestPaymentStatus: "pending" })).toBe(false);
    expect(isSelfFundedFeeEligible({ id: "a", status: "approved", salesCount: 0, proofStatus: "not_registered", proofRequestPaymentStatus: "paid" })).toBe(false);
  });
});

describe("filterSelfFundedFeeEligible", () => {
  it("returns only the eligible image ids", () => {
    expect(
      filterSelfFundedFeeEligible([
        { id: "ok", status: "approved", salesCount: 0, proofStatus: "not_registered", proofRequestPaymentStatus: "none" },
        { id: "sold", status: "approved", salesCount: 1, proofStatus: "not_registered" },
        { id: "paid", status: "approved", salesCount: 0, proofStatus: "not_registered", proofRequestPaymentStatus: "paid" },
      ])
    ).toEqual(["ok"]);
  });
});

describe("computeRegistrationFeeAmount", () => {
  it("multiplies the unit fee by the count", () => {
    expect(computeRegistrationFeeAmount(10000, 3)).toEqual({ unitFeeKrw: 10000, count: 3, amountKrw: 30000 });
  });

  it("clamps invalid inputs to zero", () => {
    expect(computeRegistrationFeeAmount(-5, 3)).toEqual({ unitFeeKrw: 0, count: 3, amountKrw: 0 });
    expect(computeRegistrationFeeAmount(10000, 0)).toEqual({ unitFeeKrw: 10000, count: 0, amountKrw: 0 });
  });
});

describe("fee order status transitions", () => {
  it("only pending orders can be canceled", () => {
    expect(canCancelFeeOrder("pending")).toBe(true);
    expect(canCancelFeeOrder("paid")).toBe(false);
    expect(canCancelFeeOrder("refunded")).toBe(false);
  });

  it("only paid orders can be refunded", () => {
    expect(canRefundFeeOrder("paid")).toBe(true);
    expect(canRefundFeeOrder("pending")).toBe(false);
    expect(canRefundFeeOrder("canceled")).toBe(false);
  });
});

describe("feeOrderName", () => {
  it("summarizes single and multi-image fee orders", () => {
    expect(feeOrderName(1)).toBe("Arweave 셀프등록 수수료");
    expect(feeOrderName(3)).toBe("Arweave 셀프등록 수수료 외 2건");
  });
});
