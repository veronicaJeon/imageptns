import { createHash } from "node:crypto";
import type { SemanticImageEmbeddingProvider } from "./semantic-embedding";
import { VoyageEmbeddingError } from "./voyage-multimodal";

export const SEMANTIC_INDEXING_DEFAULT_BATCH_SIZE = 1;
export const SEMANTIC_INDEXING_MAX_BATCH_SIZE = 3;
export const SEMANTIC_INDEXING_MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export interface ClaimedSemanticEmbeddingJob {
  id: string;
  claim_token: string;
  image_id: string;
  provider: string;
  model: string;
  model_version: string;
  dimension: number;
  attempt_count: number;
}

export interface SemanticIndexingImage {
  id: string;
  status: string;
  lifecycle_status: string | null;
  is_published: boolean;
  approved_at: string | null;
  storage_path_preview: string | null;
}

export interface SemanticIndexingRepository {
  enqueueEligibleImages(input: {
    provider: string;
    model: string;
    modelVersion: string;
    dimensions: number;
    batchSize: number;
  }): Promise<number>;
  claimJobs(input: {
    provider: string;
    model: string;
    modelVersion: string;
    batchSize: number;
  }): Promise<ClaimedSemanticEmbeddingJob[]>;
  loadImage(imageId: string): Promise<SemanticIndexingImage | null>;
  downloadPreview(storagePath: string): Promise<Blob>;
  completeJob(input: {
    job: ClaimedSemanticEmbeddingJob;
    embedding: number[];
    sourceSha256: string;
  }): Promise<boolean>;
  markStale(job: ClaimedSemanticEmbeddingJob, code: string): Promise<void>;
  markFailed(input: {
    job: ClaimedSemanticEmbeddingJob;
    code: string;
    message: string;
    retryable: boolean;
  }): Promise<void>;
}

export interface SemanticIndexingRunSummary extends SemanticIndexingWorkerSummary {
  queued: number;
}

export interface SemanticIndexingWorkerSummary {
  claimed: number;
  ready: number;
  failed: number;
  stale: number;
  retryable: number;
}

class IndexingJobError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    message: string,
  ) {
    super(message);
  }
}

export function isSemanticIndexableImage(image: SemanticIndexingImage | null): image is SemanticIndexingImage {
  return Boolean(
    image
    && image.status === "approved"
    && image.lifecycle_status === "active"
    && image.is_published === true
    && image.approved_at,
  );
}

function boundedBatchSize(value: number | undefined) {
  if (!Number.isInteger(value) || !value) return SEMANTIC_INDEXING_DEFAULT_BATCH_SIZE;
  return Math.min(Math.max(value, 1), SEMANTIC_INDEXING_MAX_BATCH_SIZE);
}

function previewMimeType(blob: Blob, storagePath: string) {
  if (blob.type === "image/jpeg" || blob.type === "image/png" || blob.type === "image/webp") return blob.type;
  const extension = storagePath.split("?")[0].toLowerCase();
  if (extension.endsWith(".jpg") || extension.endsWith(".jpeg")) return "image/jpeg" as const;
  if (extension.endsWith(".png")) return "image/png" as const;
  if (extension.endsWith(".webp")) return "image/webp" as const;
  throw new IndexingJobError("UNSUPPORTED_PREVIEW_TYPE", false, "Preview image type is unsupported");
}

function sanitizedFailure(error: unknown) {
  if (error instanceof VoyageEmbeddingError) {
    return { code: error.code, retryable: error.retryable, message: "Embedding provider request failed" };
  }
  if (error instanceof IndexingJobError) {
    return { code: error.code, retryable: error.retryable, message: error.message };
  }
  return { code: "INDEXING_INTERNAL_ERROR", retryable: true, message: "Semantic indexing failed" };
}

export async function runSemanticIndexingWorker(input: {
  repository: SemanticIndexingRepository;
  provider: SemanticImageEmbeddingProvider;
  batchSize?: number;
}): Promise<SemanticIndexingWorkerSummary> {
  const { repository, provider } = input;
  const descriptor = provider.descriptor;
  const jobs = await repository.claimJobs({
    provider: descriptor.provider,
    model: descriptor.model,
    modelVersion: descriptor.modelVersion,
    batchSize: boundedBatchSize(input.batchSize),
  });
  const summary: SemanticIndexingWorkerSummary = {
    claimed: jobs.length,
    ready: 0,
    failed: 0,
    stale: 0,
    retryable: 0,
  };

  // Sequential processing deliberately bounds provider concurrency and avoids
  // multiplying rate-limit failures when the account has a low RPM allowance.
  for (const job of jobs) {
    try {
      if (
        job.provider !== descriptor.provider
        || job.model !== descriptor.model
        || job.model_version !== descriptor.modelVersion
        || job.dimension !== descriptor.dimensions
      ) {
        throw new IndexingJobError("JOB_MODEL_MISMATCH", false, "Claimed job does not match the active model");
      }

      const image = await repository.loadImage(job.image_id);
      if (!isSemanticIndexableImage(image)) {
        await repository.markStale(job, "IMAGE_NOT_INDEXABLE");
        summary.stale += 1;
        continue;
      }
      if (!image.storage_path_preview) {
        throw new IndexingJobError("PREVIEW_PATH_MISSING", false, "Approved image preview is missing");
      }

      const preview = await repository.downloadPreview(image.storage_path_preview);
      if (preview.size < 1 || preview.size > SEMANTIC_INDEXING_MAX_IMAGE_BYTES) {
        throw new IndexingJobError("PREVIEW_SIZE_INVALID", false, "Preview image size is invalid");
      }
      const bytes = new Uint8Array(await preview.arrayBuffer());
      const embedding = await provider.embedImageDocument({
        purpose: "document",
        bytes,
        mimeType: previewMimeType(preview, image.storage_path_preview),
      });

      // A reviewer may unpublish/archive the image while the provider request is
      // in flight. Recheck before asking the atomic completion RPC to persist it.
      const currentImage = await repository.loadImage(job.image_id);
      if (!isSemanticIndexableImage(currentImage)) {
        await repository.markStale(job, "IMAGE_BECAME_INELIGIBLE");
        summary.stale += 1;
        continue;
      }

      const completed = await repository.completeJob({
        job,
        embedding,
        sourceSha256: createHash("sha256").update(bytes).digest("hex"),
      });
      if (completed) summary.ready += 1;
      else summary.stale += 1;
    } catch (error) {
      const failure = sanitizedFailure(error);
      await repository.markFailed({ job, ...failure });
      summary.failed += 1;
      if (failure.retryable) summary.retryable += 1;
    }
  }

  return summary;
}

export async function runSemanticIndexingCycle(input: {
  repository: SemanticIndexingRepository;
  provider: SemanticImageEmbeddingProvider;
  batchSize?: number;
}): Promise<SemanticIndexingRunSummary> {
  const batchSize = boundedBatchSize(input.batchSize);
  const descriptor = input.provider.descriptor;
  const queued = await input.repository.enqueueEligibleImages({
    provider: descriptor.provider,
    model: descriptor.model,
    modelVersion: descriptor.modelVersion,
    dimensions: descriptor.dimensions,
    batchSize,
  });
  const result = await runSemanticIndexingWorker({ ...input, batchSize });
  return { queued, ...result };
}
