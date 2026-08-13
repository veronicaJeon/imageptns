import { describe, expect, it } from "vitest";
import {
  assertEmbeddingRetrievalModel,
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

  it("registers named generative VLMs only for caption-bridge experiments", () => {
    const modelIds = SEMANTIC_MODEL_CANDIDATES.map((model) => model.model);
    expect(modelIds).toContain("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning");
    expect(modelIds).toContain("google/gemma-4-31b-it");
    expect(modelIds).toContain("google/gemma-4-26b-a4b-it");
    expect(modelIds).toContain("meta/llama-3.2-90b-vision-instruct");
    expect(modelIds.some((id) => id.toLowerCase().includes("muse-glimmer"))).toBe(false);

    const gemma = SEMANTIC_MODEL_CANDIDATES.find((model) => model.model === "google/gemma-4-31b-it")!;
    expect(supportsEvaluationStage(gemma, "image-to-image", "caption-bridge")).toBe(true);
    expect(supportsEvaluationStage(gemma, "text-to-image", "retrieval")).toBe(false);
    expect(isRuntimeActivationEligible(gemma)).toBe(false);
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
