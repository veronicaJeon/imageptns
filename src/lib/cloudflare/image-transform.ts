interface WorkerSelfReference {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface CloudflareImageTransformOptions {
  width: number;
  height?: number;
  format: "image/jpeg" | "image/webp";
  quality: number;
  rotate?: 0 | 90 | 180 | 270;
}

export class CloudflareImageTransformError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CloudflareImageTransformError";
  }
}

async function workerSelfReference() {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const context = await getCloudflareContext<Record<string, unknown>, unknown>({ async: true });
    return (context.env as { WORKER_SELF_REFERENCE?: WorkerSelfReference }).WORKER_SELF_REFERENCE ?? null;
  } catch {
    return null;
  }
}

export async function transformImageWithCloudflare(
  input: Buffer,
  options: CloudflareImageTransformOptions,
) {
  const service = await workerSelfReference();
  if (!service) return null;

  const response = await service.fetch("https://imagepartners.internal/__internal/image-transform", {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Image-Width": String(options.width),
      ...(options.height == null ? {} : { "X-Image-Height": String(options.height) }),
      "X-Image-Format": options.format,
      "X-Image-Quality": String(options.quality),
      "X-Image-Rotate": String(options.rotate ?? 0),
    },
    body: Uint8Array.from(input).buffer,
  });
  if (!response.ok) {
    throw new CloudflareImageTransformError(
      (await response.text().catch(() => "")) || "Cloudflare image transformation failed",
      response.status,
    );
  }
  return Buffer.from(await response.arrayBuffer());
}
