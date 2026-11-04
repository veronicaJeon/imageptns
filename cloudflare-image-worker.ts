import {
  createCloudflareImageFingerprint,
  UnsupportedCloudflareImageTypeError,
} from "./cloudflare-image-fingerprint";
import encodePng, { init as initPngEncoder } from "@jsquash/png/encode.js";
// @ts-expect-error Wrangler loads this package asset as a WebAssembly.Module.
import pngCodecWasm from "@jsquash/png/codec/pkg/squoosh_png_bg.wasm";
import { pixelWatermarkImage } from "./src/lib/images/watermark-svg";

type ImagesOutput = {
  response(options?: { headers?: HeadersInit }): Response;
};

type ImagesTransform = {
  transform(options: Record<string, unknown>): ImagesTransform;
  draw(image: ImagesTransform, options?: Record<string, unknown>): ImagesTransform;
  output(options: Record<string, unknown>): Promise<ImagesOutput>;
};

type ImagesInfo = {
  width: number;
  height: number;
  format: string;
};

type ImageWorkerEnv = {
  IMAGES: {
    input(stream: ReadableStream): ImagesTransform;
    info(stream: ReadableStream): Promise<ImagesInfo>;
  };
};

const INTERNAL_FINGERPRINT_PATH = "/__internal/image-fingerprint";
const INTERNAL_NORMALIZE_PATH = "/__internal/image-normalize";
const INTERNAL_TRANSFORM_PATH = "/__internal/image-transform";
const INTERNAL_WATERMARK_PATH = "/__internal/image-watermark";
const PHOTO_SEARCH_MAX_FILE_BYTES = 3_500_000;
const PHOTO_SEARCH_MAX_IMAGE_PIXELS = 3_000_000;
const TRANSFORM_MAX_FILE_BYTES = 20_000_000;
let pngEncoderReady: Promise<unknown> | null = null;

async function encodedWatermark(unit: number) {
  pngEncoderReady ??= initPngEncoder(pngCodecWasm);
  await pngEncoderReady;
  return encodePng(pixelWatermarkImage(unit) as ImageData);
}

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
    const response = output.response({ headers: { "Cache-Control": "private, no-store" } });
    const outputBytes = await response.arrayBuffer();
    const info = await env.IMAGES.info(new Blob([outputBytes]).stream());
    const headers = new Headers(response.headers);
    headers.set("X-Image-Width", String(info.width));
    headers.set("X-Image-Height", String(info.height));
    return new Response(outputBytes, { status: response.status, headers });
  } catch (error) {
    console.error("[cloudflare-image] transform failed", error instanceof Error ? error.message : "unknown");
    return new Response("Image transformation failed", { status: 400 });
  }
}

async function createWatermarkResponse(request: Request, env: ImageWorkerEnv) {
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0) return new Response("Image is required", { status: 400 });
  if (bytes.byteLength > TRANSFORM_MAX_FILE_BYTES) return new Response("Image is too large", { status: 413 });

  const mode = request.headers.get("x-image-watermark-mode");
  const width = integerHeader(request, "x-image-width", 32, 4_096);
  const height = integerHeader(request, "x-image-height", 32, 4_096);
  const rotate = integerHeader(request, "x-image-rotate", 0, 270);
  if (
    (mode !== "preview" && mode !== "thumbnail")
    || rotate == null
    || ![0, 90, 180, 270].includes(rotate)
    || (mode === "thumbnail" && (width == null || height == null))
  ) {
    return new Response("Invalid watermark transformation", { status: 400 });
  }

  try {
    const sourceInfo = await env.IMAGES.info(new Blob([bytes]).stream());
    const canvasWidth = rotate === 90 || rotate === 270 ? sourceInfo.height : sourceInfo.width;
    const canvasHeight = rotate === 90 || rotate === 270 ? sourceInfo.width : sourceInfo.height;
    let image = env.IMAGES.input(new Blob([bytes]).stream());
    if (rotate !== 0) image = image.transform({ rotate });
    const primaryUnit = Math.max(3, Math.min(14, Math.round(Math.min(canvasWidth, canvasHeight) * 0.008)));
    const cornerUnit = Math.max(2, Math.round(primaryUnit * 0.42));
    const safePadding = Math.max(12, Math.round(Math.min(canvasWidth, canvasHeight) * 0.025));
    const [primaryWatermark, cornerWatermark] = await Promise.all([
      encodedWatermark(primaryUnit),
      encodedWatermark(cornerUnit),
    ]);
    image = image
      .draw(env.IMAGES.input(new Blob([primaryWatermark], { type: "image/png" }).stream()), {
        opacity: 0.26,
      })
      .draw(env.IMAGES.input(new Blob([cornerWatermark], { type: "image/png" }).stream()), {
        right: safePadding,
        bottom: safePadding,
        opacity: 0.72,
      });
    if (mode === "thumbnail") {
      image = image.transform({ width, height, fit: "scale-down" });
    }
    const output = await image.output({
      format: "image/jpeg",
      quality: mode === "preview" ? 88 : 74,
      anim: false,
    });
    return output.response({ headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[cloudflare-image] watermark failed", error instanceof Error ? error.message : "unknown");
    return new Response("Image watermark failed", { status: 400 });
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
    if (internalRequest(request, INTERNAL_WATERMARK_PATH)) {
      return createWatermarkResponse(request, env);
    }
    return new Response("Not found", { status: 404 });
  },
};
