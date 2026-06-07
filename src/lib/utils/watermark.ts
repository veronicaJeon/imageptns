import sharp from "sharp";
import { normalizeRotationDegrees } from "@/lib/images/orientation";

function watermarkSvg(w: number, h: number) {
  const fontSize = Math.max(22, Math.min(76, Math.round(Math.min(w, h) * 0.05)));
  const smallSize = Math.max(12, Math.round(fontSize * 0.32));

  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${w}" height="${h}" fill="transparent"/>
    <text x="${w / 2}" y="${h / 2}"
      font-family="Arial, Helvetica, sans-serif"
      font-size="${fontSize}"
      font-weight="800"
      fill="white"
      fill-opacity="0.28"
      text-anchor="middle"
      dominant-baseline="middle"
      letter-spacing="${Math.round(fontSize * 0.14)}"
      transform="rotate(-24 ${w / 2} ${h / 2})"
    >IMAGE PARTNERS</text>
    <text x="${w - 18}" y="${h - 18}"
      font-family="Arial, Helvetica, sans-serif"
      font-size="${smallSize}"
      font-weight="700"
      fill="white"
      fill-opacity="0.68"
      text-anchor="end"
      dominant-baseline="auto"
      letter-spacing="${Math.round(smallSize * 0.12)}"
    >IMAGE PARTNERS PREVIEW</text>
  </svg>`;
}

export async function applyWatermark(input: Buffer, rotationDegrees: unknown = 0): Promise<Buffer> {
  const base = await sharp(input)
    .rotate()
    .rotate(normalizeRotationDegrees(rotationDegrees))
    .jpeg({ quality: 95 })
    .toBuffer({ resolveWithObject: true });

  const w = base.info.width || 800;
  const h = base.info.height || 600;

  return sharp(base.data)
    .composite([{ input: Buffer.from(watermarkSvg(w, h)), blend: "over" }])
    .jpeg({ quality: 88 })
    .toBuffer();
  // No catch — let errors propagate so callers know the watermark failed
}

export async function createWatermarkedThumbnail(input: Buffer, width = 320, height = 240, rotationDegrees: unknown = 0): Promise<Buffer> {
  const resized = await sharp(input)
    .rotate()
    .rotate(normalizeRotationDegrees(rotationDegrees))
    .resize(width, height, { fit: "cover", withoutEnlargement: true })
    .jpeg({ quality: 74 })
    .toBuffer({ resolveWithObject: true });

  const w = resized.info.width || width;
  const h = resized.info.height || height;

  return sharp(resized.data)
    .composite([{ input: Buffer.from(watermarkSvg(w, h)), blend: "over" }])
    .jpeg({ quality: 74 })
    .toBuffer();
}
