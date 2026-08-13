import type {
  ImageDocumentEmbeddingInput,
  ImageQueryEmbeddingInput,
  TextEmbeddingInput,
} from "./semantic-embedding";

export type SemanticModelProvider = "voyage" | "nvidia";
export type SemanticEvaluationTrack = "image-to-image" | "text-to-image";
export type SemanticModelLifecycle = "candidate" | "deprecated";
export type SemanticEvaluationStage = "retrieval" | "reranking" | "caption-bridge";

interface SemanticModelDescriptorBase {
  id: string;
  provider: SemanticModelProvider;
  model: string;
  modelVersion: string;
  lifecycle: SemanticModelLifecycle;
  publisher: "voyage" | "nvidia" | "google" | "meta";
}

export interface EmbeddingRetrievalModelDescriptor extends SemanticModelDescriptorBase {
  role: "embedding-retrieval";
  dimensions: readonly number[];
  capabilities: {
    imageDocument: boolean;
    imageQuery: boolean;
    textQuery: boolean;
  };
}

export interface VisionRerankerModelDescriptor extends SemanticModelDescriptorBase {
  role: "vision-reranker";
  capabilities: {
    textQueryWithImageDocuments: boolean;
    imageQueryWithImageDocuments: boolean;
  };
}

export interface GenerativeVisionModelDescriptor extends SemanticModelDescriptorBase {
  role: "generative-vision";
  capabilities: {
    imageInput: boolean;
    textInput: boolean;
    supportedPromptLanguages: "multilingual" | "english-only" | "unverified";
  };
}

export type SemanticModelDescriptor =
  | EmbeddingRetrievalModelDescriptor
  | VisionRerankerModelDescriptor
  | GenerativeVisionModelDescriptor;

/**
 * Provider adapters are intentionally separated by task. A generative VLM
 * cannot satisfy an embedding or reranking contract merely because it accepts
 * images.
 */
export interface EmbeddingRetrievalAdapter {
  readonly descriptor: EmbeddingRetrievalModelDescriptor;
  embedImageDocument(input: ImageDocumentEmbeddingInput): Promise<number[]>;
  embedImageQuery?(input: ImageQueryEmbeddingInput): Promise<number[]>;
  embedTextQuery?(input: TextEmbeddingInput): Promise<number[]>;
}

export interface VisionRerankerCandidate {
  imageId: string;
  imageBytes: Uint8Array;
  mimeType: ImageDocumentEmbeddingInput["mimeType"];
}

export interface VisionRerankerAdapter {
  readonly descriptor: VisionRerankerModelDescriptor;
  rerankTextToImages?(input: {
    query: string;
    candidates: readonly VisionRerankerCandidate[];
    signal?: AbortSignal;
  }): Promise<readonly { imageId: string; score: number }[]>;
  rerankImageToImages?(input: {
    query: ImageQueryEmbeddingInput;
    candidates: readonly VisionRerankerCandidate[];
    signal?: AbortSignal;
  }): Promise<readonly { imageId: string; score: number }[]>;
}

export interface GenerativeVisionAdapter {
  readonly descriptor: GenerativeVisionModelDescriptor;
  generate(input: {
    prompt: string;
    image?: ImageQueryEmbeddingInput;
    signal?: AbortSignal;
  }): Promise<string>;
}

export const SEMANTIC_MODEL_CANDIDATES = [
  {
    id: "voyage:multimodal-3.5",
    provider: "voyage",
    model: "voyage-multimodal-3.5",
    modelVersion: "provider-managed",
    lifecycle: "candidate",
    publisher: "voyage",
    role: "embedding-retrieval",
    dimensions: [256, 512, 1024, 2048],
    capabilities: { imageDocument: true, imageQuery: true, textQuery: true },
  },
  {
    id: "nvidia:nvclip",
    provider: "nvidia",
    model: "nvidia/nvclip",
    modelVersion: "provider-managed",
    lifecycle: "deprecated",
    publisher: "nvidia",
    role: "embedding-retrieval",
    dimensions: [1024],
    capabilities: { imageDocument: true, imageQuery: true, textQuery: true },
  },
  {
    id: "nvidia:nemotron-embed-vl-1b-v2",
    provider: "nvidia",
    model: "nvidia/llama-nemotron-embed-vl-1b-v2",
    modelVersion: "provider-managed",
    lifecycle: "candidate",
    publisher: "nvidia",
    role: "embedding-retrieval",
    dimensions: [2048],
    capabilities: { imageDocument: true, imageQuery: false, textQuery: true },
  },
  {
    id: "nvidia:nemotron-rerank-vl-1b-v2",
    provider: "nvidia",
    model: "nvidia/llama-nemotron-rerank-vl-1b-v2",
    modelVersion: "provider-managed",
    lifecycle: "candidate",
    publisher: "nvidia",
    role: "vision-reranker",
    capabilities: {
      textQueryWithImageDocuments: true,
      imageQueryWithImageDocuments: false,
    },
  },
  {
    id: "nvidia-build:nemotron-3-nano-omni-30b-a3b-reasoning",
    provider: "nvidia",
    publisher: "nvidia",
    model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    modelVersion: "provider-managed",
    lifecycle: "candidate",
    role: "generative-vision",
    capabilities: { imageInput: true, textInput: true, supportedPromptLanguages: "unverified" },
  },
  {
    id: "nvidia-build:gemma-4-31b-it",
    provider: "nvidia",
    publisher: "google",
    model: "google/gemma-4-31b-it",
    modelVersion: "provider-managed",
    lifecycle: "candidate",
    role: "generative-vision",
    capabilities: { imageInput: true, textInput: true, supportedPromptLanguages: "multilingual" },
  },
  {
    id: "nvidia-build:gemma-4-26b-a4b-it",
    provider: "nvidia",
    publisher: "google",
    model: "google/gemma-4-26b-a4b-it",
    modelVersion: "provider-managed",
    lifecycle: "candidate",
    role: "generative-vision",
    capabilities: { imageInput: true, textInput: true, supportedPromptLanguages: "multilingual" },
  },
  {
    id: "nvidia-build:llama-3.2-90b-vision-instruct",
    provider: "nvidia",
    publisher: "meta",
    model: "meta/llama-3.2-90b-vision-instruct",
    modelVersion: "provider-managed",
    lifecycle: "candidate",
    role: "generative-vision",
    capabilities: { imageInput: true, textInput: true, supportedPromptLanguages: "english-only" },
  },
] as const satisfies readonly SemanticModelDescriptor[];

export function validateSemanticModelRegistry(registry: readonly SemanticModelDescriptor[]) {
  const ids = new Set<string>();
  for (const descriptor of registry) {
    if (ids.has(descriptor.id)) throw new Error(`Duplicate semantic model id: ${descriptor.id}`);
    ids.add(descriptor.id);

    if (descriptor.role === "embedding-retrieval") {
      if (descriptor.dimensions.length === 0) throw new Error(`Embedding model ${descriptor.id} has no dimensions`);
      if (descriptor.dimensions.some((dimension) => !Number.isInteger(dimension) || dimension < 1 || dimension > 4_000)) {
        throw new Error(`Embedding model ${descriptor.id} has an invalid dimension`);
      }
    }
  }
  return registry;
}

export function supportsEvaluationTrack(
  descriptor: SemanticModelDescriptor,
  track: SemanticEvaluationTrack,
) {
  if (descriptor.role === "embedding-retrieval") {
    return descriptor.capabilities.imageDocument
      && (track === "image-to-image" ? descriptor.capabilities.imageQuery : descriptor.capabilities.textQuery);
  }
  if (descriptor.role === "vision-reranker") {
    return track === "image-to-image"
      ? descriptor.capabilities.imageQueryWithImageDocuments
      : descriptor.capabilities.textQueryWithImageDocuments;
  }
  return false;
}

export function supportsEvaluationStage(
  descriptor: SemanticModelDescriptor,
  track: SemanticEvaluationTrack,
  stage: SemanticEvaluationStage,
) {
  if (stage === "retrieval") {
    return descriptor.role === "embedding-retrieval" && supportsEvaluationTrack(descriptor, track);
  }
  if (stage === "reranking") {
    return descriptor.role === "vision-reranker" && supportsEvaluationTrack(descriptor, track);
  }
  return descriptor.role === "generative-vision" && descriptor.capabilities.imageInput;
}

export function isRuntimeActivationEligible(descriptor: SemanticModelDescriptor) {
  return descriptor.lifecycle === "candidate" && descriptor.role === "embedding-retrieval";
}

export function assertEmbeddingRetrievalModel(
  descriptor: SemanticModelDescriptor,
): asserts descriptor is EmbeddingRetrievalModelDescriptor {
  if (descriptor.role !== "embedding-retrieval") {
    throw new Error(`${descriptor.id} is ${descriptor.role}, not an embedding retrieval model`);
  }
}
