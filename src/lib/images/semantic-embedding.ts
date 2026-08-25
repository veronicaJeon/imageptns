export const SEMANTIC_EMBEDDING_MAX_DIMENSIONS = 4_000;

export type SemanticEmbeddingProviderName = "voyage" | "nvidia";

export interface SemanticEmbeddingCapabilities {
  imageDocument: boolean;
  imageQuery: boolean;
  textQuery: boolean;
}

export interface SemanticEmbeddingModelDescriptor {
  provider: SemanticEmbeddingProviderName;
  model: string;
  modelVersion: string;
  dimensions: number;
  capabilities: SemanticEmbeddingCapabilities;
}

interface ImageEmbeddingInputBase {
  bytes: Uint8Array;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  signal?: AbortSignal;
}

export interface ImageDocumentEmbeddingInput extends ImageEmbeddingInputBase {
  purpose: "document";
}

export interface ImageQueryEmbeddingInput extends ImageEmbeddingInputBase {
  purpose: "query";
}

export interface TextEmbeddingInput {
  text: string;
  purpose: "query";
  signal?: AbortSignal;
}

/**
 * Runtime provider adapters implement only the methods declared by their
 * capability descriptor. Provider payloads and credentials stay inside the
 * adapter and never become part of the ranking or persistence contracts.
 */
export interface SemanticImageEmbeddingProvider {
  readonly descriptor: SemanticEmbeddingModelDescriptor;
  embedImageDocument(input: ImageDocumentEmbeddingInput): Promise<number[]>;
  embedImageQuery?(input: ImageQueryEmbeddingInput): Promise<number[]>;
  embedTextQuery?(input: TextEmbeddingInput): Promise<number[]>;
}

export interface SemanticImageSearchConfig {
  enabled: boolean;
  indexingEnabled?: boolean;
  queryEnabled?: boolean;
  provider?: SemanticEmbeddingProviderName;
  model?: string;
  modelVersion?: string;
  dimensions?: number;
}

export interface SemanticImageSearchEnvironment {
  [key: string]: string | undefined;
  SEMANTIC_IMAGE_SEARCH_ENABLED?: string;
  SEMANTIC_IMAGE_INDEXING_ENABLED?: string;
  SEMANTIC_IMAGE_QUERY_ENABLED?: string;
  SEMANTIC_EMBEDDING_PROVIDER?: string;
  SEMANTIC_EMBEDDING_MODEL?: string;
  SEMANTIC_EMBEDDING_MODEL_VERSION?: string;
  SEMANTIC_EMBEDDING_DIMENSIONS?: string;
}

function required(value: string | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${label} is required when semantic image search is enabled`);
  return normalized;
}

export function getSemanticImageSearchConfig(
  environment: SemanticImageSearchEnvironment = process.env,
): SemanticImageSearchConfig {
  if (environment.SEMANTIC_IMAGE_SEARCH_ENABLED !== "true") {
    return { enabled: false, indexingEnabled: false, queryEnabled: false };
  }

  const indexingEnabled = environment.SEMANTIC_IMAGE_INDEXING_ENABLED === "true";
  const queryEnabled = environment.SEMANTIC_IMAGE_QUERY_ENABLED === "true";
  if (!indexingEnabled && !queryEnabled) {
    return { enabled: true, indexingEnabled: false, queryEnabled: false };
  }

  const provider = required(environment.SEMANTIC_EMBEDDING_PROVIDER, "SEMANTIC_EMBEDDING_PROVIDER");
  if (provider !== "voyage" && provider !== "nvidia") {
    throw new Error("SEMANTIC_EMBEDDING_PROVIDER must be voyage or nvidia");
  }

  const rawDimensions = required(environment.SEMANTIC_EMBEDDING_DIMENSIONS, "SEMANTIC_EMBEDDING_DIMENSIONS");
  const dimensions = Number(rawDimensions);
  if (!Number.isInteger(dimensions) || dimensions < 1 || dimensions > SEMANTIC_EMBEDDING_MAX_DIMENSIONS) {
    throw new Error(`SEMANTIC_EMBEDDING_DIMENSIONS must be an integer between 1 and ${SEMANTIC_EMBEDDING_MAX_DIMENSIONS}`);
  }

  return {
    enabled: true,
    indexingEnabled,
    queryEnabled,
    provider,
    model: required(environment.SEMANTIC_EMBEDDING_MODEL, "SEMANTIC_EMBEDDING_MODEL"),
    modelVersion: analysisBackedModelVersion(
      required(environment.SEMANTIC_EMBEDDING_MODEL_VERSION, "SEMANTIC_EMBEDDING_MODEL_VERSION"),
    ),
    dimensions,
  };
}

export function assertPhotoSearchCapabilities(descriptor: SemanticEmbeddingModelDescriptor) {
  if (!descriptor.capabilities.imageDocument || !descriptor.capabilities.imageQuery) {
    throw new Error("Semantic photo search requires imageDocument and imageQuery capabilities");
  }
}

export function validateEmbeddingVector(values: number[], expectedDimensions: number) {
  if (values.length !== expectedDimensions) {
    throw new Error(`Embedding dimension mismatch: expected ${expectedDimensions}, received ${values.length}`);
  }
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error("Embedding contains a non-finite value");
  }
  return values;
}
import { analysisBackedModelVersion } from "./analysis-derivative";
