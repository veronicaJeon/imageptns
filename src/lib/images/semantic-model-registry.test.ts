import { describe, expect, it } from "vitest";
import {
  assertEmbeddingRetrievalModel,
  ASYNC_CAPTION_LATENCY_BUDGET_MS,
  INTERACTIVE_SEARCH_LATENCY_BUDGET_MS,
  isRuntimeActivationEligible,
  SEMANTIC_MODEL_CANDIDATES,
  supportsEvaluationTrack,
  supportsEvaluationStage,
  validateSemanticModelRegistry,
  type GenerativeVisionModelDescriptor,
  type SemanticModelDescriptor,
} from "./semantic-model-registry";

describe("semantic model registry", () => {
  it("validates the provider-neutral candidate registry", () => {
    expect(validateSemanticModelRegistry(SEMANTIC_MODEL_CANDIDATES)).toBe(SEMANTIC_MODEL_CANDIDATES);
  });

  it("keeps image-to-image and text-to-image support distinct", () => {
    const nemotronEmbedding = SEMANTIC_MODEL_CANDIDATES.find(
      (model) => model.id === "nvidia:nemotron-embed-vl-1b-v2",
    )!;
    expect(supportsEvaluationTrack(nemotronEmbedding, "image-to-image")).toBe(false);
    expect(supportsEvaluationTrack(nemotronEmbedding, "text-to-image")).toBe(true);

    const voyage = SEMANTIC_MODEL_CANDIDATES.find((model) => model.provider === "voyage")!;
    expect(supportsEvaluationTrack(voyage, "image-to-image")).toBe(true);
    expect(supportsEvaluationTrack(voyage, "text-to-image")).toBe(true);
  });

  it("keeps deprecated models benchmarkable but ineligible for runtime activation", () => {
    const nvclip = SEMANTIC_MODEL_CANDIDATES.find((model) => model.id === "nvidia:nvclip")!;
    expect(supportsEvaluationTrack(nvclip, "image-to-image")).toBe(true);
    expect(isRuntimeActivationEligible(nvclip)).toBe(false);

    const reranker = SEMANTIC_MODEL_CANDIDATES.find((model) => model.role === "vision-reranker")!;
    expect(() => assertEmbeddingRetrievalModel(reranker)).toThrow("not an embedding retrieval model");
    expect(supportsEvaluationTrack(reranker, "text-to-image")).toBe(true);
    expect(isRuntimeActivationEligible(reranker)).toBe(false);
  });

  it("never admits a generative VLM into retrieval evaluation", () => {
    const generative: GenerativeVisionModelDescriptor = {
      id: "nvidia:generative-vlm-candidate",
      provider: "nvidia",
      model: "nvidia/generative-vlm-candidate",
      modelVersion: "test",
      lifecycle: "candidate",
      publisher: "nvidia",
      role: "generative-vision",
      capabilities: { imageInput: true, textInput: true, supportedPromptLanguages: "unverified" },
    };

    expect(supportsEvaluationTrack(generative, "image-to-image")).toBe(false);
    expect(supportsEvaluationTrack(generative, "text-to-image")).toBe(false);
    expect(() => assertEmbeddingRetrievalModel(generative)).toThrow("generative-vision");
  });

  it("keeps only the sub-five-second VLM as a caption candidate", () => {
    const modelIds = SEMANTIC_MODEL_CANDIDATES.map((model) => model.model);
    expect(modelIds).toContain("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning");
    expect(modelIds).toContain("google/gemma-4-31b-it");
    expect(modelIds).toContain("google/gemma-4-26b-a4b-it");
    expect(modelIds).toContain("meta/llama-3.2-90b-vision-instruct");
    expect(modelIds.some((id) => id.toLowerCase().includes("muse-glimmer"))).toBe(false);

    const omni = SEMANTIC_MODEL_CANDIDATES.find(
      (model) => model.model === "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    )!;
    expect(omni.lifecycle).toBe("candidate");
    expect(omni.observedLatencyMilliseconds).toBeLessThan(ASYNC_CAPTION_LATENCY_BUDGET_MS);
    expect(supportsEvaluationStage(omni, "image-to-image", "caption-bridge")).toBe(true);

    for (const modelName of ["google/gemma-4-31b-it", "google/gemma-4-26b-a4b-it", "meta/llama-3.2-90b-vision-instruct"]) {
      const excluded = SEMANTIC_MODEL_CANDIDATES.find((model) => model.model === modelName)!;
      expect(excluded.lifecycle).toBe("excluded");
      expect(isRuntimeActivationEligible(excluded)).toBe(false);
    }

    const reranker = SEMANTIC_MODEL_CANDIDATES.find((model) => model.role === "vision-reranker")!;
    expect(reranker.lifecycle).toBe("excluded");
    expect(reranker.observedLatencyMilliseconds).toBeGreaterThan(INTERACTIVE_SEARCH_LATENCY_BUDGET_MS);
  });

  it("rejects duplicate ids and invalid embedding dimensions", () => {
    const duplicate = [SEMANTIC_MODEL_CANDIDATES[0], SEMANTIC_MODEL_CANDIDATES[0]];
    expect(() => validateSemanticModelRegistry(duplicate)).toThrow("Duplicate semantic model id");

    const invalid = {
      ...SEMANTIC_MODEL_CANDIDATES[0],
      dimensions: [0],
    } as unknown as SemanticModelDescriptor;
    expect(() => validateSemanticModelRegistry([invalid])).toThrow("invalid dimension");
  });
});
