import { describe, expect, it, vi } from "vitest";
import type { SemanticImageEmbeddingProvider } from "./semantic-embedding";
import {
  runSemanticIndexingWorker,
  type ClaimedSemanticEmbeddingJob,
  type SemanticIndexingImage,
  type SemanticIndexingRepository,
} from "./semantic-indexing-worker";
import { VoyageEmbeddingError } from "./voyage-multimodal";

const job: ClaimedSemanticEmbeddingJob = {
  id: "job-1",
  claim_token: "claim-1",
  image_id: "image-1",
  provider: "voyage",
  model: "voyage-multimodal-3.5",
  model_version: "provider-managed",
  dimension: 2,
  attempt_count: 1,
};

const image: SemanticIndexingImage = {
  id: "image-1",
  status: "approved",
  lifecycle_status: "active",
  is_published: true,
  approved_at: "2026-08-18T00:00:00.000Z",
  storage_path_preview: "photographer/image.webp",
};

function setup() {
  const repository: SemanticIndexingRepository = {
    claimJobs: vi.fn().mockResolvedValue([job]),
    loadImage: vi.fn().mockResolvedValue(image),
    downloadPreview: vi.fn().mockResolvedValue(new Blob([Uint8Array.from([1, 2, 3])], { type: "image/webp" })),
    completeJob: vi.fn().mockResolvedValue(true),
    markStale: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
  };
  const provider: SemanticImageEmbeddingProvider = {
    descriptor: {
      provider: "voyage",
      model: "voyage-multimodal-3.5",
      modelVersion: "provider-managed",
      dimensions: 2,
      capabilities: { imageDocument: true, imageQuery: true, textQuery: true },
    },
    embedImageDocument: vi.fn().mockResolvedValue([0.1, 0.2]),
  };
  return { repository, provider };
}

describe("semantic indexing worker", () => {
  it("downloads an approved preview server-side and completes the claimed job", async () => {
    const { repository, provider } = setup();
    const result = await runSemanticIndexingWorker({ repository, provider, batchSize: 100 });

    expect(repository.claimJobs).toHaveBeenCalledWith(expect.objectContaining({ batchSize: 3 }));
    expect(repository.downloadPreview).toHaveBeenCalledWith("photographer/image.webp");
    expect(provider.embedImageDocument).toHaveBeenCalledWith(expect.objectContaining({
      purpose: "document",
      bytes: Uint8Array.from([1, 2, 3]),
      mimeType: "image/webp",
    }));
    expect(repository.loadImage).toHaveBeenCalledTimes(2);
    expect(repository.completeJob).toHaveBeenCalledWith(expect.objectContaining({
      job,
      embedding: [0.1, 0.2],
      sourceSha256: "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81",
    }));
    expect(result).toEqual({ claimed: 1, ready: 1, failed: 0, stale: 0, retryable: 0 });
  });

  it.each([
    { status: "rejected" },
    { lifecycle_status: "archived" },
    { is_published: false },
    { approved_at: null },
  ])("marks a claimed row stale when approval eligibility changed: %o", async (change) => {
    const { repository, provider } = setup();
    vi.mocked(repository.loadImage).mockResolvedValue({ ...image, ...change });

    const result = await runSemanticIndexingWorker({ repository, provider });

    expect(repository.markStale).toHaveBeenCalledWith(job, "IMAGE_NOT_INDEXABLE");
    expect(repository.downloadPreview).not.toHaveBeenCalled();
    expect(provider.embedImageDocument).not.toHaveBeenCalled();
    expect(result.stale).toBe(1);
  });

  it("does not persist an embedding when an image becomes unpublished in flight", async () => {
    const { repository, provider } = setup();
    vi.mocked(repository.loadImage)
      .mockResolvedValueOnce(image)
      .mockResolvedValueOnce({ ...image, is_published: false });

    const result = await runSemanticIndexingWorker({ repository, provider });

    expect(provider.embedImageDocument).toHaveBeenCalledOnce();
    expect(repository.completeJob).not.toHaveBeenCalled();
    expect(repository.markStale).toHaveBeenCalledWith(job, "IMAGE_BECAME_INELIGIBLE");
    expect(result.stale).toBe(1);
  });

  it("stores only a sanitized retryable provider failure", async () => {
    const { repository, provider } = setup();
    vi.mocked(provider.embedImageDocument).mockRejectedValue(
      new VoyageEmbeddingError("VOYAGE_HTTP_429", true),
    );

    const result = await runSemanticIndexingWorker({ repository, provider });

    expect(repository.markFailed).toHaveBeenCalledWith({
      job,
      code: "VOYAGE_HTTP_429",
      message: "Embedding provider request failed",
      retryable: true,
    });
    expect(result).toEqual({ claimed: 1, ready: 0, failed: 1, stale: 0, retryable: 1 });
  });
});
