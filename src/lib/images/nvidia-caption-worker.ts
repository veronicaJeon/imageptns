import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateNvidiaCaption, NvidiaCaptionError } from "./nvidia-caption";
import { isSemanticIndexableImage, type SemanticIndexingImage } from "./semantic-indexing-worker";
import { ensureAnalysisDerivative } from "./analysis-derivative-server";
import { analysisBackedModelVersion } from "./analysis-derivative";

interface CaptionJob {
  id: string;
  claim_token: string;
  image_id: string;
  provider: string;
  model: string;
  model_version: string;
}

export async function runNvidiaCaptionCycle(input: {
  apiKey: string;
  model: string;
  modelVersion: string;
}) {
  const admin = createAdminClient();
  const identifiers = {
    p_provider: "nvidia",
    p_model: input.model,
    p_model_version: analysisBackedModelVersion(input.modelVersion),
  };
  const { data: queued, error: enqueueError } = await admin.rpc("enqueue_ai_caption_backfill", {
    ...identifiers,
    p_batch_size: 1,
  });
  if (enqueueError) throw new Error("Caption enqueue failed");
  const { data, error: claimError } = await admin.rpc("claim_ai_caption_jobs", {
    ...identifiers,
    p_batch_size: 1,
  });
  if (claimError) throw new Error("Caption claim failed");
  const jobs = (data ?? []) as CaptionJob[];
  const summary = { queued: Number(queued ?? 0), claimed: jobs.length, ready: 0, failed: 0, stale: 0 };

  for (const job of jobs) {
    try {
      const { data: image, error: imageError } = await admin.from("images")
        .select("id, status, lifecycle_status, is_published, approved_at, storage_path_original, storage_path_analysis, analysis_derivative_version, upload_rotation_degrees")
        .eq("id", job.image_id).maybeSingle();
      if (imageError) throw new Error("Caption image lookup failed");
      if (!isSemanticIndexableImage(image as SemanticIndexingImage | null)) {
        await admin.rpc("finish_ai_caption_job_failure", {
          p_job_id: job.id, p_claim_token: job.claim_token, p_error_code: "IMAGE_NOT_INDEXABLE",
          p_retryable: false, p_mark_stale: true,
        });
        summary.stale += 1;
        continue;
      }
      const derivative = await ensureAnalysisDerivative(admin, image as SemanticIndexingImage);
      const result = await generateNvidiaCaption({
        apiKey: input.apiKey,
        model: input.model,
        bytes: new Uint8Array(derivative.bytes),
        mimeType: derivative.mimeType,
      });
      const { data: completed, error: completeError } = await admin.rpc("complete_ai_caption_job", {
        p_job_id: job.id,
        p_claim_token: job.claim_token,
        p_caption_en: result.captionEn,
        p_keywords_en: result.keywordsEn,
      });
      if (completeError) throw new Error("Caption completion failed");
      if (completed) {
        summary.ready += 1;
      } else {
        await admin.rpc("finish_ai_caption_job_failure", {
          p_job_id: job.id,
          p_claim_token: job.claim_token,
          p_error_code: "IMAGE_BECAME_INELIGIBLE",
          p_retryable: false,
          p_mark_stale: true,
        });
        summary.stale += 1;
      }
    } catch (error) {
      const code = error instanceof NvidiaCaptionError ? error.code : "CAPTION_INTERNAL_ERROR";
      const retryable = error instanceof NvidiaCaptionError ? error.retryable : true;
      await admin.rpc("finish_ai_caption_job_failure", {
        p_job_id: job.id,
        p_claim_token: job.claim_token,
        p_error_code: code,
        p_retryable: retryable,
        p_mark_stale: false,
      });
      summary.failed += 1;
    }
  }
  return summary;
}
