import { describe, expect, it } from "vitest";
import { evaluateOperationsReview, type OperationsReviewMetrics } from "./operations-review";

function healthyMetrics(): OperationsReviewMetrics {
  return {
    inventory: { publicImages: 80, missingPreview: 0, invalidPreview: 0, missingAnalysis: 0 },
    workflow: {
      imageReviewOver24h: 0,
      photographerApplicationOver48h: 0,
      generalInquiryOver24h: 0,
      photoRequestOver24h: 0,
      bankTransferOver24h: 0,
    },
    semantic: { enabled: true, ready: 80, pending: 0, failed: 0, missing: 0 },
    delivery: { failedOrderEmails: 0 },
    reliability: { requestErrors24h: 0 },
    activity24h: { newUsers: 0, uploads: 0, completedOrders: 0, downloads: 0 },
    activityPrevious24h: { newUsers: 0, uploads: 0, completedOrders: 0, downloads: 0 },
  };
}

describe("evaluateOperationsReview", () => {
  it("keeps a quiet beta healthy when operational queues are clear", () => {
    expect(evaluateOperationsReview(healthyMetrics())).toEqual({
      status: "ok",
      metrics: healthyMetrics(),
      findings: [],
    });
  });

  it("raises warnings for operator SLA and indexing backlog", () => {
    const metrics = healthyMetrics();
    metrics.workflow.photoRequestOver24h = 2;
    metrics.semantic.missing = 1;
    const result = evaluateOperationsReview(metrics);
    expect(result.status).toBe("warning");
    expect(result.findings.map((finding) => finding.code)).toEqual([
      "PHOTO_REQUEST_SLA",
      "SEMANTIC_INDEX_MISSING",
    ]);
  });

  it("raises an error for broken public previews or repeated server errors", () => {
    const metrics = healthyMetrics();
    metrics.inventory.invalidPreview = 1;
    metrics.reliability.requestErrors24h = 5;
    const result = evaluateOperationsReview(metrics);
    expect(result.status).toBe("error");
    expect(result.findings.every((finding) => finding.severity === "error")).toBe(true);
  });

  it("warns only when a meaningful activity baseline drops sharply", () => {
    const metrics = healthyMetrics();
    metrics.activityPrevious24h.uploads = 5;
    expect(evaluateOperationsReview(metrics).findings.map((finding) => finding.code)).toContain("ACTIVITY_DROP");
    metrics.activityPrevious24h.uploads = 4;
    expect(evaluateOperationsReview(metrics).findings).toEqual([]);
  });
});
