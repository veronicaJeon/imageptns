import { normalizeRotationDegrees } from "../images/orientation";
import { watermarkImageWithCloudflare } from "../cloudflare/image-transform";
import { watermarkSvg } from "../images/watermark-svg";

async function loadSharp() {
  return (await import("sharp")).default;
}

export async function applyWatermark(input: Buffer, rotationDegrees: unknown = 0): Promise<Buffer> {
  const sharp = await loadSharp();
  const base = await sharp(input)
    .rotate()
    .rotate(normalizeRotationDegrees(rotationDegrees))
    .jpeg({ quality: 95 })
    .toBuffer({ resolveWithObject: true });

  const w = base.info.width || 800;
  const h = base.info.height || 600;

  return applyWatermarkToAnalysisDerivative(base.data, w, h);
  // No catch — let errors propagate so callers know the watermark failed
}

export async function applyWatermarkToAnalysisDerivative(
  input: Buffer,
  knownWidth?: number,
  knownHeight?: number,
): Promise<Buffer> {
  const cloudflareOutput = await watermarkImageWithCloudflare(input, {
    mode: "preview",
    width: knownWidth,
    height: knownHeight,
  });
  if (cloudflareOutput) return cloudflareOutput;

  const sharp = await loadSharp();
  const metadata = knownWidth && knownHeight ? null : await sharp(input).metadata();
  const w = knownWidth ?? metadata?.width ?? 800;
  const h = knownHeight ?? metadata?.height ?? 600;
  return sharp(input)
    .composite([{ input: Buffer.from(watermarkSvg(w, h)), blend: "over" }])
    .jpeg({ quality: 88 })
    .toBuffer();
}

export async function createWatermarkedThumbnail(input: Buffer, width = 320, height = 240, rotationDegrees: unknown = 0): Promise<Buffer> {
  const rotation = normalizeRotationDegrees(rotationDegrees);
  const cloudflareOutput = await watermarkImageWithCloudflare(input, {
    mode: "thumbnail",
    width,
    height,
    rotate: rotation,
  });
  if (cloudflareOutput) return cloudflareOutput;

  const sharp = await loadSharp();
  const resized = await sharp(input)
    .rotate()
    .rotate(rotation)
    .resize(width, height, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 74 })
    .toBuffer({ resolveWithObject: true });

  const w = resized.info.width || width;
  const h = resized.info.height || height;

  return sharp(resized.data)
    .composite([{ input: Buffer.from(watermarkSvg(w, h)), blend: "over" }])
    .jpeg({ quality: 74 })
    .toBuffer();
}

export async function resizeWatermarkedPreview(input: Buffer, width = 320, height = 240): Promise<Buffer> {
  const sharp = await loadSharp();
  return sharp(input)
    .rotate()
    .resize(width, height, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 74 })
    .toBuffer();
}
