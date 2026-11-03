import decodeJpeg, { init as initJpeg } from "@jsquash/jpeg/decode.js";
import decodePng, { init as initPng } from "@jsquash/png/decode.js";
import resize, { initResize } from "@jsquash/resize";
import decodeWebp, { init as initWebp } from "@jsquash/webp/decode.js";
import jpegDecodeWasm from "@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm";
// @ts-expect-error Wrangler loads this package asset as a WebAssembly.Module.
import pngDecodeWasm from "@jsquash/png/codec/pkg/squoosh_png_bg.wasm";
// @ts-expect-error Wrangler loads this package asset as a WebAssembly.Module.
import resizeWasm from "@jsquash/resize/lib/resize/pkg/squoosh_resize_bg.wasm";
import webpDecodeWasm from "@jsquash/webp/codec/dec/webp_dec.wasm";
import {
  createPortableImageFingerprint,
  type PortableImageData,
} from "./src/lib/images/portable-fingerprint";

const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

let codecsReady: Promise<unknown> | null = null;

function initialiseCodecs() {
  codecsReady ??= Promise.all([
    initJpeg(jpegDecodeWasm),
    initPng(pngDecodeWasm),
    initWebp(webpDecodeWasm),
    initResize(resizeWasm),
  ]);
  return codecsReady;
}

async function decode(bytes: ArrayBuffer, contentType: string): Promise<PortableImageData> {
  await initialiseCodecs();
  if (contentType === "image/jpeg") {
    return decodeJpeg(bytes, { preserveOrientation: true });
  }
  if (contentType === "image/png") return decodePng(bytes);
  if (contentType === "image/webp") return decodeWebp(bytes);
  throw new UnsupportedCloudflareImageTypeError();
}

async function sha256(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export class UnsupportedCloudflareImageTypeError extends Error {
  constructor() {
    super("Unsupported image format");
    this.name = "UnsupportedCloudflareImageTypeError";
  }
}

export async function createCloudflareImageFingerprint(
  bytes: ArrayBuffer,
  contentType: string,
  rotationDegrees = 0,
) {
  const normalizedType = contentType.toLowerCase();
  if (!SUPPORTED_TYPES.has(normalizedType)) throw new UnsupportedCloudflareImageTypeError();
  const decoded = await decode(bytes, normalizedType);
  return createPortableImageFingerprint({
    originalBytes: bytes,
    decoded,
    rotationDegrees,
    sha256,
    resize: async (image, width, height) => resize(image as ImageData, {
      width,
      height,
      method: "lanczos3",
      fitMethod: "stretch",
      premultiply: true,
      linearRGB: true,
    }),
  });
}
