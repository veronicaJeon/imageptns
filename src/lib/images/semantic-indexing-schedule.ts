import "server-only";
import { getNvidiaCaptionConfig } from "./nvidia-caption";
import { runNvidiaCaptionCycle } from "./nvidia-caption-worker";
import { getSemanticImageSearchConfig } from "./semantic-embedding";
import { createSupabaseSemanticIndexingRepository } from "./semantic-indexing-repository";
import { runSemanticIndexingCycle } from "./semantic-indexing-worker";
import { VoyageMultimodalEmbeddingProvider } from "./voyage-multimodal";

export class AiIndexingConfigurationError extends Error {}

export async function runScheduledAiIndexing() {
  let config;
  try {
    config = getSemanticImageSearchConfig();
  } catch {
    throw new AiIndexingConfigurationError("Semantic indexing configuration is invalid");
  }
  const captionConfig = getNvidiaCaptionConfig();
  if ((!config.enabled || !config.indexingEnabled) && !captionConfig.enabled) {
    return { ok: true as const, skipped: "ai_indexing_disabled" as const };
  }
  if (captionConfig.enabled && !captionConfig.productionEntitled) {
    throw new AiIndexingConfigurationError("NVIDIA production entitlement is not confirmed");
  }
  if (
    config.indexingEnabled
    && (config.provider !== "voyage" || !config.model || !config.modelVersion || !config.dimensions)
  ) {
    throw new AiIndexingConfigurationError("Voyage semantic indexing is not configured");
  }

  const voyageApiKey = process.env.VOYAGE_API_KEY?.trim();
  if (config.indexingEnabled && !voyageApiKey) {
    throw new AiIndexingConfigurationError("VOYAGE_API_KEY is not configured");
  }
  const semantic = config.indexingEnabled
    ? await runSemanticIndexingCycle({
      repository: createSupabaseSemanticIndexingRepository(),
      provider: new VoyageMultimodalEmbeddingProvider({
        apiKey: voyageApiKey!,
        model: config.model!,
        modelVersion: config.modelVersion!,
        dimensions: config.dimensions!,
      }),
    })
    : { skipped: "semantic_indexing_disabled" as const };

  const nvidiaApiKey = process.env.NVIDIA_API_KEY?.trim();
  if (captionConfig.enabled && !nvidiaApiKey) {
    throw new AiIndexingConfigurationError("NVIDIA_API_KEY is not configured");
  }
  const captions = captionConfig.enabled
    ? await runNvidiaCaptionCycle({
      apiKey: nvidiaApiKey!,
      model: captionConfig.model,
      modelVersion: captionConfig.modelVersion,
    })
    : { skipped: "nvidia_captioning_disabled" as const };

  return { ok: true as const, semantic, captions };
}
