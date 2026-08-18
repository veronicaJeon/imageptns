import {
  validateEmbeddingVector,
  type ImageDocumentEmbeddingInput,
  type ImageQueryEmbeddingInput,
  type SemanticImageEmbeddingProvider,
  type SemanticEmbeddingModelDescriptor,
  type TextEmbeddingInput,
} from "./semantic-embedding";

export const VOYAGE_MULTIMODAL_ENDPOINT = "https://api.voyageai.com/v1/multimodalembeddings";
export const VOYAGE_QUERY_TIMEOUT_MS = 1_500;
export const VOYAGE_DOCUMENT_TIMEOUT_MS = 10_000;

type FetchLike = typeof fetch;

export class VoyageEmbeddingError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable: boolean,
  ) {
    super("Voyage embedding request failed");
    this.name = "VoyageEmbeddingError";
  }
}

interface VoyageMultimodalOptions {
  apiKey: string;
  model: string;
  modelVersion: string;
  dimensions: number;
  fetchImplementation?: FetchLike;
  queryTimeoutMs?: number;
  documentTimeoutMs?: number;
}

function dataUrl(bytes: Uint8Array, mimeType: string) {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
}

function requestSignal(parent: AbortSignal | undefined, timeoutMilliseconds: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), timeoutMilliseconds);
  const abort = () => controller.abort(parent?.reason);
  parent?.addEventListener("abort", abort, { once: true });
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timeout);
      parent?.removeEventListener("abort", abort);
    },
  };
}

function statusError(response: Response) {
  const retryable = response.status === 408 || response.status === 409
    || response.status === 429 || response.status >= 500;
  return new VoyageEmbeddingError(`VOYAGE_HTTP_${response.status}`, retryable);
}

/**
 * Server-only Voyage adapter. Image URLs are deliberately unsupported: callers
 * must download the approved derivative themselves and pass bytes so private
 * storage locations never leave Image Partners.
 */
export class VoyageMultimodalEmbeddingProvider implements SemanticImageEmbeddingProvider {
  readonly descriptor: SemanticEmbeddingModelDescriptor;
  private readonly apiKey: string;
  private readonly fetchImplementation: FetchLike;
  private readonly queryTimeoutMs: number;
  private readonly documentTimeoutMs: number;

  constructor(options: VoyageMultimodalOptions) {
    if (!options.apiKey.trim()) throw new Error("VOYAGE_API_KEY is required");
    this.apiKey = options.apiKey;
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.queryTimeoutMs = options.queryTimeoutMs ?? VOYAGE_QUERY_TIMEOUT_MS;
    this.documentTimeoutMs = options.documentTimeoutMs ?? VOYAGE_DOCUMENT_TIMEOUT_MS;
    this.descriptor = {
      provider: "voyage",
      model: options.model,
      modelVersion: options.modelVersion,
      dimensions: options.dimensions,
      capabilities: { imageDocument: true, imageQuery: true, textQuery: true },
    };
  }

  embedImageDocument(input: ImageDocumentEmbeddingInput) {
    return this.embed(
      [{ type: "image_base64", image_base64: dataUrl(input.bytes, input.mimeType) }],
      "document",
      input.signal,
      this.documentTimeoutMs,
    );
  }

  embedImageQuery(input: ImageQueryEmbeddingInput) {
    return this.embed(
      [{ type: "image_base64", image_base64: dataUrl(input.bytes, input.mimeType) }],
      "query",
      input.signal,
      this.queryTimeoutMs,
    );
  }

  embedTextQuery(input: TextEmbeddingInput) {
    const text = input.text.trim();
    if (!text || text.length > 2_000) throw new Error("Semantic text query must be between 1 and 2000 characters");
    return this.embed(
      [{ type: "text", text }],
      "query",
      input.signal,
      this.queryTimeoutMs,
    );
  }

  private async embed(
    content: Array<Record<string, string>>,
    inputType: "query" | "document",
    parentSignal: AbortSignal | undefined,
    timeoutMilliseconds: number,
  ) {
    const timeout = requestSignal(parentSignal, timeoutMilliseconds);
    try {
      const response = await this.fetchImplementation(VOYAGE_MULTIMODAL_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: [{ content }],
          model: this.descriptor.model,
          input_type: inputType,
          output_dimension: this.descriptor.dimensions,
          truncation: false,
        }),
        signal: timeout.signal,
      });

      if (!response.ok) throw statusError(response);
      const payload = await response.json() as { data?: Array<{ embedding?: unknown }> };
      const embedding = payload.data?.[0]?.embedding;
      if (!Array.isArray(embedding) || embedding.some((value) => typeof value !== "number")) {
        throw new VoyageEmbeddingError("VOYAGE_INVALID_RESPONSE", true);
      }
      try {
        return validateEmbeddingVector(embedding as number[], this.descriptor.dimensions);
      } catch {
        throw new VoyageEmbeddingError("VOYAGE_INVALID_RESPONSE", true);
      }
    } catch (error) {
      if (error instanceof VoyageEmbeddingError) throw error;
      if (timeout.signal.aborted) throw new VoyageEmbeddingError("VOYAGE_TIMEOUT", true);
      throw new VoyageEmbeddingError("VOYAGE_NETWORK_ERROR", true);
    } finally {
      timeout.dispose();
    }
  }
}
