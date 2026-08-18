import { describe, expect, it, vi } from "vitest";
import {
  VOYAGE_MULTIMODAL_ENDPOINT,
  VoyageEmbeddingError,
  VoyageMultimodalEmbeddingProvider,
} from "./voyage-multimodal";

function provider(fetchImplementation: typeof fetch, queryTimeoutMs = 1_500) {
  return new VoyageMultimodalEmbeddingProvider({
    apiKey: "test-key",
    model: "voyage-multimodal-3.5",
    modelVersion: "provider-managed",
    dimensions: 2,
    fetchImplementation,
    queryTimeoutMs,
  });
}

describe("Voyage multimodal embedding adapter", () => {
  it("sends image bytes as a document data URL without exposing a storage URL", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      data: [{ embedding: [0.1, 0.2] }],
    }), { status: 200 }));

    await expect(provider(request).embedImageDocument({
      purpose: "document",
      bytes: Uint8Array.from([1, 2, 3]),
      mimeType: "image/jpeg",
    })).resolves.toEqual([0.1, 0.2]);

    expect(request).toHaveBeenCalledWith(VOYAGE_MULTIMODAL_ENDPOINT, expect.objectContaining({
      method: "POST",
    }));
    const options = request.mock.calls[0][1]!;
    const body = JSON.parse(String(options.body));
    expect(body).toMatchObject({
      model: "voyage-multimodal-3.5",
      input_type: "document",
      output_dimension: 2,
      inputs: [{ content: [{ type: "image_base64", image_base64: "data:image/jpeg;base64,AQID" }] }],
    });
    expect(String(options.body)).not.toContain("storage/v1");
  });

  it("uses query input type and a bounded timeout for Korean text", async () => {
    const request = vi.fn<typeof fetch>().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));

    const error = await provider(request, 5).embedTextQuery({
      purpose: "query",
      text: "고요한 새벽의 도시",
    }).catch((caught) => caught);

    expect(error).toBeInstanceOf(VoyageEmbeddingError);
    expect(error.code).toBe("VOYAGE_TIMEOUT");
    const body = JSON.parse(String(request.mock.calls[0][1]?.body));
    expect(body.input_type).toBe("query");
    expect(body.inputs[0].content[0]).toEqual({ type: "text", text: "고요한 새벽의 도시" });
  });

  it("returns sanitized retry metadata without reading provider error bodies", async () => {
    const response = new Response("secret provider payload", { status: 429 });
    const error = await provider(vi.fn<typeof fetch>().mockResolvedValue(response)).embedImageQuery({
      purpose: "query",
      bytes: Uint8Array.from([1]),
      mimeType: "image/webp",
    }).catch((caught) => caught);

    expect(error).toMatchObject({ code: "VOYAGE_HTTP_429", retryable: true });
    expect(error.message).not.toContain("secret provider payload");
  });

  it("rejects malformed and wrong-dimension responses", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      data: [{ embedding: [0.1] }],
    }), { status: 200 }));

    await expect(provider(request).embedTextQuery({ purpose: "query", text: "도시" }))
      .rejects.toMatchObject({ code: "VOYAGE_INVALID_RESPONSE", retryable: true });
  });
});
