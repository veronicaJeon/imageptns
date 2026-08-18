import { describe, expect, it } from "vitest";
import { buildSemanticEmbeddingQueueRow, type SemanticIndexableImage } from "./semantic-indexing";
import type { SemanticImageSearchConfig } from "./semantic-embedding";

const enabledConfig: SemanticImageSearchConfig = {
  enabled: true,
  provider: "voyage",
  model: "voyage-multimodal-3.5",
  modelVersion: "2026-08",
  dimensions: 512,
};

const approvedImage: SemanticIndexableImage = {
  id: "image-1",
  status: "approved",
  lifecycle_status: "active",
  is_published: true,
  approved_at: "2026-08-18T00:00:00.000Z",
};

describe("semantic catalog indexing eligibility", () => {
  it("creates a pending queue row only after approval", () => {
    expect(buildSemanticEmbeddingQueueRow(approvedImage, enabledConfig)).toEqual({
      image_id: "image-1",
      provider: "voyage",
      model: "voyage-multimodal-3.5",
      model_version: "2026-08",
      dimension: 512,
      status: "pending",
    });
  });

  it.each([
    { status: "pending" },
    { status: "rejected" },
    { lifecycle_status: "cancelled" },
    { is_published: false },
    { approved_at: null },
  ])("does not queue an upload that is not eligible: %o", (override) => {
    expect(buildSemanticEmbeddingQueueRow({ ...approvedImage, ...override }, enabledConfig)).toBeNull();
  });

  it("does not queue work while semantic search is disabled", () => {
    expect(buildSemanticEmbeddingQueueRow(approvedImage, { enabled: false })).toBeNull();
  });
});
