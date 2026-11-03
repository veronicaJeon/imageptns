// OpenNext generates this module during `npm run build:cloudflare`.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- generated module may not exist before the Cloudflare build
// @ts-ignore Generated module is intentionally not committed.
import openNextWorker from "./.open-next/worker.js";
import {
  createCloudflareImageFingerprint,
  UnsupportedCloudflareImageTypeError,
} from "./cloudflare-image-fingerprint";

// Re-export the durable objects expected by the generated OpenNext worker.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- generated module may not exist before the Cloudflare build
// @ts-ignore Generated module is intentionally not committed.
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";

type WorkerEnv = {
  CRON_SECRET?: string;
  LEGACY_IMAGE_ORIGIN?: string;
  IMAGES?: ImagesBinding;
};

type ImagesOutput = {
  response(options?: { headers?: HeadersInit }): Response;
};

type ImagesTransform = {
  transform(options: Record<string, unknown>): ImagesTransform;
  output(options: Record<string, unknown>): Promise<ImagesOutput>;
};

type ImagesBinding = {
  input(stream: ReadableStream): ImagesTransform;
};

type WorkerContext = {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
};

type ScheduledController = {
  cron: string;
  scheduledTime: number;
  noRetry(): void;
};

const LEGACY_IMAGE_PATHS = new Set([
  "/api/admin/about-page/library-assets",
  "/api/admin/auth-pages/library-assets",
  "/api/admin/operations",
  "/api/admin/repair-preview",
  "/api/admin/semantic-indexing",
  "/api/cron/ai-synthetic",
  "/api/cron/operations-review",
  "/api/cron/semantic-indexing",
  "/api/images/thumbnail",
  "/api/uploads",
]);

const INTERNAL_FINGERPRINT_PATH = "/__internal/image-fingerprint";
const INTERNAL_NORMALIZE_PATH = "/__internal/image-normalize";
const PHOTO_SEARCH_MAX_FILE_BYTES = 3_500_000;
const PHOTO_SEARCH_MAX_IMAGE_PIXELS = 3_000_000;

function shouldUseLegacyImageRuntime(request: Request) {
  return LEGACY_IMAGE_PATHS.has(new URL(request.url).pathname);
}

async function proxyToLegacyImageRuntime(request: Request, env: WorkerEnv) {
  if (!env.LEGACY_IMAGE_ORIGIN) {
    return new Response("Image processing origin is not configured", { status: 503 });
  }

  const target = new URL(request.url);
  const origin = new URL(env.LEGACY_IMAGE_ORIGIN);
  target.protocol = origin.protocol;
  target.host = origin.host;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("x-forwarded-host");
  headers.delete("x-forwarded-proto");

  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(65_000)]);
  try {
    const upstreamRequest = new Request(new Request(target.toString(), request), {
      headers,
      redirect: "manual",
      signal,
    });
    const response = await fetch(upstreamRequest);
    const proxied = new Response(response.body, response);
    proxied.headers.set("x-imagepartners-runtime", "legacy-image");
    return proxied;
  } catch (error) {
    if (signal.aborted) {
      return new Response("Image processing origin timed out", { status: 504 });
    }
    throw error;
  }
}

async function createFingerprintResponse(request: Request) {
  const url = new URL(request.url);
  if (url.hostname !== "imagepartners.internal" || request.method !== "POST") {
    return new Response("Not found", { status: 404 });
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > PHOTO_SEARCH_MAX_FILE_BYTES) {
    return Response.json({ error: "Search image is too large" }, { status: 413 });
  }

  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() ?? "";
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0) {
    return Response.json({ error: "Search image is required" }, { status: 400 });
  }
  if (bytes.byteLength > PHOTO_SEARCH_MAX_FILE_BYTES) {
    return Response.json({ error: "Search image is too large" }, { status: 413 });
  }

  try {
    const fingerprint = await createCloudflareImageFingerprint(bytes, contentType);
    if (fingerprint.width * fingerprint.height > PHOTO_SEARCH_MAX_IMAGE_PIXELS) {
      return Response.json({ error: "Search image dimensions are too large" }, { status: 413 });
    }
    return Response.json(fingerprint, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof UnsupportedCloudflareImageTypeError) {
      return Response.json({ error: error.message }, { status: 415 });
    }
    console.error("[cloudflare-image] fingerprint failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "Invalid image file" }, { status: 400 });
  }
}

async function createNormalizedImageResponse(request: Request, env: WorkerEnv) {
  const url = new URL(request.url);
  if (url.hostname !== "imagepartners.internal" || request.method !== "POST") {
    return new Response("Not found", { status: 404 });
  }
  if (!env.IMAGES) return new Response("Image normalization is unavailable", { status: 503 });

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0) return new Response("Image is required", { status: 400 });
  if (bytes.byteLength > PHOTO_SEARCH_MAX_FILE_BYTES) return new Response("Image is too large", { status: 413 });

  try {
    const output = await env.IMAGES
      .input(new Blob([bytes]).stream())
      .transform({ width: 1_024, height: 1_024, fit: "scale-down" })
      .output({ format: "image/jpeg", quality: 85, anim: false });
    return output.response({ headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[cloudflare-image] normalization failed", error instanceof Error ? error.message : "unknown");
    return new Response("Image normalization failed", { status: 400 });
  }
}

const worker = {
  async fetch(request: Request, env: WorkerEnv, ctx: WorkerContext) {
    const pathname = new URL(request.url).pathname;
    if (pathname === INTERNAL_FINGERPRINT_PATH) {
      return createFingerprintResponse(request);
    }
    if (pathname === INTERNAL_NORMALIZE_PATH) {
      return createNormalizedImageResponse(request, env);
    }

    if (shouldUseLegacyImageRuntime(request)) {
      return proxyToLegacyImageRuntime(request, env);
    }

    const response = await openNextWorker.fetch(request, env, ctx);
    if (pathname !== "/api/images/search-by-photo") return response;
    const marked = new Response(response.body, response);
    marked.headers.set("x-imagepartners-runtime", "cloudflare-image");
    return marked;
  },

  async scheduled(controller: ScheduledController, env: WorkerEnv, ctx: WorkerContext) {
    if (controller.cron !== "0 2 * * *") return;
    if (!env.CRON_SECRET) throw new Error("CRON_SECRET is not configured");

    const response = await openNextWorker.fetch(new Request(
      "https://imagepartners.internal/api/cron/auto-reject-stale",
      { headers: { Authorization: `Bearer ${env.CRON_SECRET}` } },
    ), env, ctx);

    if (!response.ok) {
      throw new Error(`auto-reject-stale failed with HTTP ${response.status}`);
    }
  },
};

export default worker;
