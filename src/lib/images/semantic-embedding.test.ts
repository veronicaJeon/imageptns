import { describe, expect, it } from "vitest";
import {
  assertPhotoSearchCapabilities,
  getSemanticImageSearchConfig,
  validateEmbeddingVector,
  type SemanticEmbeddingModelDescriptor,
} from "./semantic-embedding";

const baseEnvironment = {
  SEMANTIC_IMAGE_SEARCH_ENABLED: "true",
  SEMANTIC_IMAGE_INDEXING_ENABLED: "true",
  SEMANTIC_IMAGE_QUERY_ENABLED: "true",
  SEMANTIC_EMBEDDING_PROVIDER: "voyage",
  SEMANTIC_EMBEDDING_MODEL: "multimodal-model",
  SEMANTIC_EMBEDDING_MODEL_VERSION: "2026-08",
  SEMANTIC_EMBEDDING_DIMENSIONS: "512",
};

describe("semantic image embedding configuration", () => {
  it("stays disabled by default without validating provider settings", () => {
    expect(getSemanticImageSearchConfig({})).toEqual({
      enabled: false,
      indexingEnabled: false,
      queryEnabled: false,
    });
    expect(getSemanticImageSearchConfig({
      SEMANTIC_IMAGE_SEARCH_ENABLED: "false",
      SEMANTIC_EMBEDDING_PROVIDER: "unsupported",
    })).toEqual({ enabled: false, indexingEnabled: false, queryEnabled: false });
  });

  it.each(["voyage", "nvidia"] as const)("accepts the %s provider only when explicitly enabled", (provider) => {
    expect(getSemanticImageSearchConfig({ ...baseEnvironment, SEMANTIC_EMBEDDING_PROVIDER: provider })).toEqual({
      enabled: true,
      indexingEnabled: true,
      queryEnabled: true,
      provider,
      model: "multimodal-model",
      modelVersion: "2026-08",
      dimensions: 512,
    });
  });

  it("requires an explicit per-path flag before loading provider configuration", () => {
    expect(getSemanticImageSearchConfig({ SEMANTIC_IMAGE_SEARCH_ENABLED: "true" })).toEqual({
      enabled: true,
      indexingEnabled: false,
      queryEnabled: false,
    });
  });

  it("rejects unsupported providers and dimensions", () => {
    expect(() => getSemanticImageSearchConfig({
      ...baseEnvironment,
      SEMANTIC_EMBEDDING_PROVIDER: "other",
    })).toThrow("must be voyage or nvidia");
    expect(() => getSemanticImageSearchConfig({
      ...baseEnvironment,
      SEMANTIC_EMBEDDING_DIMENSIONS: "4001",
    })).toThrow("between 1 and 4000");
  });
});
describe("semantic embedding provider contract", () => {
  function descriptor(capabilities: SemanticEmbeddingModelDescriptor["capabilities"]): SemanticEmbeddingModelDescriptor {
    return {
      provider: "nvidia",
      model: "candidate",
      modelVersion: "v1",
      dimensions: 2_048,
      capabilities,
    };
  }

  it("requires image document and image query support for photo search", () => {
    expect(() => assertPhotoSearchCapabilities(descriptor({
      imageDocument: true,
      imageQuery: true,
      textQuery: true,
    }))).not.toThrow();
    expect(() => assertPhotoSearchCapabilities(descriptor({
      imageDocument: true,
      imageQuery: false,
      textQuery: true,
    }))).toThrow("imageDocument and imageQuery");
  });

  it("rejects wrong-size and non-finite vectors", () => {
    expect(validateEmbeddingVector([0.1, 0.2], 2)).toEqual([0.1, 0.2]);
    expect(() => validateEmbeddingVector([0.1], 2)).toThrow("dimension mismatch");
    expect(() => validateEmbeddingVector([0.1, Number.NaN], 2)).toThrow("non-finite");
  });
});
