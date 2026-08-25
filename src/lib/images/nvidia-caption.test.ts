import { describe, expect, it, vi } from "vitest";
import {
  generateNvidiaCaption,
  getNvidiaCaptionConfig,
} from "./nvidia-caption";

describe("NVIDIA async caption adapter", () => {
  it("requires both an explicit feature flag and production entitlement", () => {
    expect(getNvidiaCaptionConfig({
      NVIDIA_CAPTIONING_ENABLED: "true",
      NVIDIA_API_PRODUCTION_ENTITLED: "false",
    })).toMatchObject({ enabled: true, productionEntitled: false });
  });

  it("returns a bounded structured caption without exposing the image URL", async () => {
    const fetchImplementation = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '{"caption_en":"A quiet blue lake at dawn.","keywords_en":["lake","dawn"]}' } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const result = await generateNvidiaCaption({
      apiKey: "secret",
      model: "nvidia/test",
      bytes: Uint8Array.from([1, 2, 3]),
      mimeType: "image/jpeg",
      fetchImplementation,
    });

    expect(result).toEqual({ captionEn: "A quiet blue lake at dawn.", keywordsEn: ["lake", "dawn"] });
    const body = JSON.parse(fetchImplementation.mock.calls[0][1].body as string);
    expect(body.messages[0].content[1].image_url.url).toMatch(/^data:image\/jpeg;base64,/);
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(body.chat_template_kwargs.enable_thinking).toBe(false);
  });

  it("classifies throttling as retryable without returning provider payloads", async () => {
    await expect(generateNvidiaCaption({
      apiKey: "secret",
      model: "nvidia/test",
      bytes: Uint8Array.from([1]),
      mimeType: "image/png",
      fetchImplementation: vi.fn().mockResolvedValue(new Response("private provider payload", { status: 429 })),
    })).rejects.toEqual(expect.objectContaining({ code: "NVIDIA_HTTP_429", retryable: true }));
  });
});
