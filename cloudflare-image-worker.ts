import {
  createCloudflareImageFingerprint,
  UnsupportedCloudflareImageTypeError,
} from "./cloudflare-image-fingerprint";

type ImagesOutput = {
  response(options?: { headers?: HeadersInit }): Response;
};

type ImagesTransform = {
  transform(options: Record<string, unknown>): ImagesTransform;
  output(options: Record<string, unknown>): Promise<ImagesOutput>;
};

type ImageWorkerEnv = {
  IMAGES: {
    input(stream: ReadableStream): ImagesTransform;
  };
};

const INTERNAL_FINGERPRINT_PATH = "/__internal/image-fingerprint";
const INTERNAL_NORMALIZE_PATH = "/__internal/image-normalize";
const INTERNAL_TRANSFORM_PATH = "/__internal/image-transform";
const PHOTO_SEARCH_MAX_FILE_BYTES = 3_500_000;
const PHOTO_SEARCH_MAX_IMAGE_PIXELS = 3_000_000;
const TRANSFORM_MAX_FILE_BYTES = 20_000_000;

function internalRequest(request: Request, pathname: string) {
  const url = new URL(request.url);
  return url.hostname === "imagepartners.internal"
    && url.pathname === pathname
    && request.method === "POST";
}

async function createFingerprintResponse(request: Request) {
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

async function createNormalizedImageResponse(request: Request, env: ImageWorkerEnv) {
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

function integerHeader(request: Request, name: string, minimum: number, maximum: number) {
  const value = Number(request.headers.get(name));
  return Number.isInteger(value) && value >= minimum && value <= maximum ? value : null;
}

async function createTransformResponse(request: Request, env: ImageWorkerEnv) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > TRANSFORM_MAX_FILE_BYTES) {
    return new Response("Image is too large", { status: 413 });
  }

  const width = integerHeader(request, "x-image-width", 32, 4_096);
  const heightHeader = request.headers.get("x-image-height");
  const height = heightHeader == null ? undefined : integerHeader(request, "x-image-height", 32, 4_096);
  const quality = integerHeader(request, "x-image-quality", 40, 95);
  const format = request.headers.get("x-image-format");
  const rotate = integerHeader(request, "x-image-rotate", 0, 270);
  if (
    width == null
    || (heightHeader != null && height == null)
    || quality == null
    || (format !== "image/jpeg" && format !== "image/webp")
    || rotate == null
    || ![0, 90, 180, 270].includes(rotate)
  ) {
    return new Response("Invalid image transformation", { status: 400 });
  }

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0) return new Response("Image is required", { status: 400 });
  if (bytes.byteLength > TRANSFORM_MAX_FILE_BYTES) return new Response("Image is too large", { status: 413 });

  try {
    let image = env.IMAGES.input(new Blob([bytes]).stream());
    if (rotate !== 0) image = image.transform({ rotate });
    image = image.transform({
      width,
      ...(height == null ? {} : { height }),
      fit: "scale-down",
    });
    const output = await image.output({ format, quality, anim: false });
    return output.response({ headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[cloudflare-image] transform failed", error instanceof Error ? error.message : "unknown");
    return new Response("Image transformation failed", { status: 400 });
  }
}

export default {
  async fetch(request: Request, env: ImageWorkerEnv) {
    if (internalRequest(request, INTERNAL_FINGERPRINT_PATH)) {
      return createFingerprintResponse(request);
    }
    if (internalRequest(request, INTERNAL_NORMALIZE_PATH)) {
      return createNormalizedImageResponse(request, env);
    }
    if (internalRequest(request, INTERNAL_TRANSFORM_PATH)) {
      return createTransformResponse(request, env);
    }
    return new Response("Not found", { status: 404 });
  },
};
