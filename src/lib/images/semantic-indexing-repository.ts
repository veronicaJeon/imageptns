import "server-only";
import { ensureAnalysisDerivative } from "./analysis-derivative-server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ClaimedSemanticEmbeddingJob,
  SemanticIndexingImage,
  SemanticIndexingRepository,
} from "./semantic-indexing-worker";

export function createSupabaseSemanticIndexingRepository(): SemanticIndexingRepository {
  const admin = createAdminClient();

  return {
    async enqueueEligibleImages({ provider, model, modelVersion, dimensions, batchSize }) {
      const { data, error } = await admin.rpc("enqueue_semantic_embedding_backfill", {
        p_provider: provider,
        p_model: model,
        p_model_version: modelVersion,
        p_dimension: dimensions,
        p_batch_size: batchSize,
      });
      if (error) throw new Error("Semantic indexing enqueue failed");
      return Number(data ?? 0);
    },

    async claimJobs({ provider, model, modelVersion, batchSize }) {
      const { data, error } = await admin.rpc("claim_semantic_embedding_jobs", {
        p_provider: provider,
        p_model: model,
        p_model_version: modelVersion,
        p_batch_size: batchSize,
      });
      if (error) throw new Error("Semantic indexing claim failed");
      return (data ?? []) as ClaimedSemanticEmbeddingJob[];
    },

    async loadImage(imageId) {
      const { data, error } = await admin
        .from("images")
        .select("id, status, lifecycle_status, is_published, approved_at, storage_path_original, storage_path_analysis, analysis_derivative_version, upload_rotation_degrees")
        .eq("id", imageId)
        .maybeSingle();
      if (error) throw new Error("Semantic indexing image lookup failed");
      return data as SemanticIndexingImage | null;
    },

    async loadAnalysisInput(image) {
      const derivative = await ensureAnalysisDerivative(admin, image);
      return {
        bytes: new Uint8Array(derivative.bytes),
        mimeType: derivative.mimeType,
        sourceSha256: derivative.sourceSha256,
      };
    },

    async completeJob({ job, embedding, sourceSha256 }) {
      const { data, error } = await admin.rpc("complete_semantic_embedding_job", {
        p_job_id: job.id,
        p_claim_token: job.claim_token,
        p_embedding: embedding,
        p_source_sha256: sourceSha256,
      });
      if (error) throw new Error("Semantic indexing completion failed");
      return data === true;
    },

    async markStale(job, code) {
      const { error } = await admin.rpc("finish_semantic_embedding_job_failure", {
        p_job_id: job.id,
        p_claim_token: job.claim_token,
        p_error_code: code,
        p_error_message: "Image is no longer eligible for semantic indexing",
        p_retryable: false,
        p_mark_stale: true,
      });
      if (error) throw new Error("Semantic indexing stale update failed");
    },

    async markFailed({ job, code, message, retryable }) {
      const { error } = await admin.rpc("finish_semantic_embedding_job_failure", {
        p_job_id: job.id,
        p_claim_token: job.claim_token,
        p_error_code: code.slice(0, 80),
        p_error_message: message.slice(0, 500),
        p_retryable: retryable,
        p_mark_stale: false,
      });
      if (error) throw new Error("Semantic indexing failure update failed");
    },
  };
}
