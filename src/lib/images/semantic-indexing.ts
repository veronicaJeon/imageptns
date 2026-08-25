import type { SemanticImageSearchConfig } from "./semantic-embedding";

export interface SemanticIndexableImage {
  id: string;
  status: string;
  lifecycle_status?: string | null;
  is_published?: boolean;
  approved_at: string | null;
}

export interface SemanticEmbeddingQueueRow {
  image_id: string;
  provider: "voyage" | "nvidia";
  model: string;
  model_version: string;
  dimension: number;
  status: "pending";
  embedding: null;
  source_sha256: null;
  attempt_count: 0;
  last_attempted_at: null;
  embedded_at: null;
  next_attempt_at: null;
  last_error_code: null;
  last_error_message: null;
  claim_token: null;
}

/**
 * Catalog embeddings are queued only after a reviewer has approved and
 * published the image. Upload, rejection, and cancellation paths must never
 * send an image to an external embedding provider.
 */
export function buildSemanticEmbeddingQueueRow(
  image: SemanticIndexableImage,
  config: SemanticImageSearchConfig,
): SemanticEmbeddingQueueRow | null {
  if (!config.enabled || config.indexingEnabled !== true) return null;
  if (
    image.status !== "approved"
    || image.lifecycle_status !== "active"
    || image.is_published !== true
    || !image.approved_at
  ) {
    return null;
  }

  return {
    image_id: image.id,
    provider: config.provider!,
    model: config.model!,
    model_version: config.modelVersion!,
    dimension: config.dimensions!,
    status: "pending",
    embedding: null,
    source_sha256: null,
    attempt_count: 0,
    last_attempted_at: null,
    embedded_at: null,
    next_attempt_at: null,
    last_error_code: null,
    last_error_message: null,
    claim_token: null,
  };
}
