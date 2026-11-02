// OpenNext generates this module during `npm run build:cloudflare`.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- generated module may not exist before the Cloudflare build
// @ts-ignore Generated module is intentionally not committed.
import openNextWorker from "./.open-next/worker.js";

// Re-export the durable objects expected by the generated OpenNext worker.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- generated module may not exist before the Cloudflare build
// @ts-ignore Generated module is intentionally not committed.
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";

type WorkerEnv = {
  CRON_SECRET?: string;
  LEGACY_IMAGE_ORIGIN?: string;
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
  "/api/images/search-by-photo",
  "/api/images/thumbnail",
  "/api/uploads",
]);

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

const worker = {
  async fetch(request: Request, env: WorkerEnv, ctx: WorkerContext) {
    if (shouldUseLegacyImageRuntime(request)) {
      return proxyToLegacyImageRuntime(request, env);
    }

    return openNextWorker.fetch(request, env, ctx);
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
