interface WorkerSelfReference {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface CloudflareImageTransformOptions {
  width: number;
  height?: number;
  format: "image/jpeg" | "image/webp";
  quality: number;
  rotate?: number;
}

export interface CloudflareImageTransformResult {
  bytes: Buffer;
  width: number | null;
  height: number | null;
}

export interface CloudflareWatermarkOptions {
  mode: "preview" | "thumbnail";
  width?: number;
  height?: number;
  rotate?: number;
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
  return (await transformImageWithCloudflareDetails(input, options))?.bytes ?? null;
}

export async function transformImageWithCloudflareDetails(
  input: Buffer,
  options: CloudflareImageTransformOptions,
): Promise<CloudflareImageTransformResult | null> {
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
  const width = Number(response.headers.get("x-image-width"));
  const height = Number(response.headers.get("x-image-height"));
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    width: Number.isInteger(width) && width > 0 ? width : null,
    height: Number.isInteger(height) && height > 0 ? height : null,
  };
}

export async function watermarkImageWithCloudflare(
  input: Buffer,
  options: CloudflareWatermarkOptions,
) {
  const service = await workerSelfReference();
  if (!service) return null;

  const response = await service.fetch("https://imagepartners.internal/__internal/image-watermark", {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Image-Watermark-Mode": options.mode,
      ...(options.width == null ? {} : { "X-Image-Width": String(options.width) }),
      ...(options.height == null ? {} : { "X-Image-Height": String(options.height) }),
      "X-Image-Rotate": String(options.rotate ?? 0),
    },
    body: Uint8Array.from(input).buffer,
  });
  if (!response.ok) {
    throw new CloudflareImageTransformError(
      (await response.text().catch(() => "")) || "Cloudflare watermark transformation failed",
      response.status,
    );
  }
  return Buffer.from(await response.arrayBuffer());
}
