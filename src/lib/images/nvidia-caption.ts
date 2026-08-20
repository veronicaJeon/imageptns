export const NVIDIA_CAPTION_ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";
export const NVIDIA_CAPTION_TIMEOUT_MS = 5_000;
export const DEFAULT_NVIDIA_CAPTION_MODEL = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning";

type FetchLike = typeof fetch;

export interface NvidiaCaptionResult {
  captionEn: string;
  keywordsEn: string[];
}

export interface NvidiaCaptionConfig {
  enabled: boolean;
  productionEntitled: boolean;
  model: string;
  modelVersion: string;
}

export class NvidiaCaptionError extends Error {
  constructor(readonly code: string, readonly retryable: boolean) {
    super("NVIDIA caption request failed");
    this.name = "NvidiaCaptionError";
  }
}

export function getNvidiaCaptionConfig(
  environment: Record<string, string | undefined> = process.env,
): NvidiaCaptionConfig {
  return {
    enabled: environment.NVIDIA_CAPTIONING_ENABLED === "true",
    productionEntitled: environment.NVIDIA_API_PRODUCTION_ENTITLED === "true",
    model: environment.NVIDIA_CAPTION_MODEL?.trim() || DEFAULT_NVIDIA_CAPTION_MODEL,
    modelVersion: environment.NVIDIA_CAPTION_MODEL_VERSION?.trim() || "provider-managed",
  };
}

function dataUrl(bytes: Uint8Array, mimeType: string) {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
}

function parseCaption(content: string): NvidiaCaptionResult {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new NvidiaCaptionError("NVIDIA_INVALID_RESPONSE", true);
  try {
    const parsed = JSON.parse(match[0]) as { caption_en?: unknown; keywords_en?: unknown };
    const captionEn = typeof parsed.caption_en === "string" ? parsed.caption_en.trim() : "";
    const keywordsEn = Array.isArray(parsed.keywords_en)
      ? parsed.keywords_en.filter((value): value is string => typeof value === "string")
        .map((value) => value.trim()).filter(Boolean).slice(0, 20)
      : [];
    if (!captionEn || captionEn.length > 1_000) throw new Error("invalid caption");
    return { captionEn, keywordsEn };
  } catch (error) {
    if (error instanceof NvidiaCaptionError) throw error;
    throw new NvidiaCaptionError("NVIDIA_INVALID_RESPONSE", true);
  }
}

export async function generateNvidiaCaption(input: {
  apiKey: string;
  model: string;
  bytes: Uint8Array;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  fetchImplementation?: FetchLike;
  timeoutMs?: number;
}): Promise<NvidiaCaptionResult> {
  if (!input.apiKey.trim()) throw new Error("NVIDIA_API_KEY is required");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), input.timeoutMs ?? NVIDIA_CAPTION_TIMEOUT_MS);
  try {
    const response = await (input.fetchImplementation ?? fetch)(NVIDIA_CAPTION_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${input.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: input.model,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Return JSON only: {\"caption_en\":\"one factual sentence\",\"keywords_en\":[\"up to 12 concrete visual terms\"]}. Do not identify people or infer sensitive traits." },
            { type: "image_url", image_url: { url: dataUrl(input.bytes, input.mimeType) } },
          ],
        }],
        max_tokens: 180,
        temperature: 0.2,
        top_p: 1,
        stream: false,
        chat_template_kwargs: { enable_thinking: false },
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const retryable = response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500;
      throw new NvidiaCaptionError(`NVIDIA_HTTP_${response.status}`, retryable);
    }
    const payload = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new NvidiaCaptionError("NVIDIA_INVALID_RESPONSE", true);
    return parseCaption(content);
  } catch (error) {
    if (error instanceof NvidiaCaptionError) throw error;
    if (controller.signal.aborted) throw new NvidiaCaptionError("NVIDIA_TIMEOUT", true);
    throw new NvidiaCaptionError("NVIDIA_NETWORK_ERROR", true);
  } finally {
    clearTimeout(timeout);
  }
}
