import { describe, expect, it } from "vitest";
import { buildOrderStatusSteps, buildUploadProofSteps } from "./status";

describe("buildOrderStatusSteps", () => {
  it("marks a confirmed onchain order as downloadable", () => {
    const steps = buildOrderStatusSteps({
      status: "completed",
      paymentProvider: "base_usdc",
      cryptoStatus: "confirmed",
      paymentTxHash: "0xabc",
    });

    expect(steps.map((step) => [step.key, step.state])).toEqual([
      ["created", "done"],
      ["payment", "done"],
      ["confirmation", "done"],
      ["download", "done"],
    ]);
  });

  it("surfaces pending onchain confirmation as current recovery step", () => {
    const steps = buildOrderStatusSteps({
      status: "pending",
      paymentProvider: "base_usdc",
      cryptoStatus: "pending",
      paymentTxHash: null,
    });

    expect(steps.find((step) => step.key === "confirmation")?.state).toBe("current");
    expect(steps.find((step) => step.key === "download")?.state).toBe("pending");
  });
});

describe("buildUploadProofSteps", () => {
  it("shows approved registered uploads as fully complete", () => {
    const steps = buildUploadProofSteps({
      status: "approved",
      proofStatus: "registered",
    });

    expect(steps.every((step) => step.state === "done")).toBe(true);
  });

  it("shows rejected uploads as blocked at review", () => {
    const steps = buildUploadProofSteps({
      status: "rejected",
      proofStatus: "not_registered",
    });

    expect(steps.find((step) => step.key === "review")?.state).toBe("failed");
    expect(steps.find((step) => step.key === "proof")?.state).toBe("pending");
  });
});
