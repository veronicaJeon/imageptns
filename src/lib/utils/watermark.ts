import sharp from "sharp";

export async function applyWatermark(input: Buffer): Promise<Buffer> {
  const image = sharp(input);
  const { width = 800, height = 600 } = await image.metadata();

  const w = width ?? 800;
  const h = height ?? 600;

  // Font size scales with image: ~3.5% of the shorter dimension, clamped
  const fontSize = Math.max(18, Math.min(72, Math.round(Math.min(w, h) * 0.035)));
  const letterSpacing = Math.round(fontSize * 0.18);

  // Build a tiled diagonal grid of "IMAGE PARTNERS" texts
  // Each tile is roughly 2.8× fontSize wide × 2.2× fontSize tall spacing
  const tileW = fontSize * 12;
  const tileH = fontSize * 5;
  const texts: string[] = [];

  // Extend coverage beyond image edges so rotation doesn't leave gaps
  for (let ty = -tileH * 2; ty < h + tileH * 2; ty += tileH) {
    for (let tx = -tileW; tx < w + tileW * 2; tx += tileW) {
      // Stagger every other row by half tileW
      const rowOffset = Math.round(ty / tileH) % 2 === 0 ? 0 : tileW / 2;
      const x = tx + rowOffset;
      const y = ty;
      texts.push(
        `<text x="${x}" y="${y}"
          font-family="Arial, Helvetica, sans-serif"
          font-size="${fontSize}"
          font-weight="bold"
          fill="white"
          fill-opacity="0.38"
          text-anchor="middle"
          dominant-baseline="middle"
          letter-spacing="${letterSpacing}"
          transform="rotate(-30 ${x} ${y})"
        >IMAGE PARTNERS</text>`
      );
    }
  }

  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  ${texts.join("\n  ")}
</svg>`;

  return image
    .composite([{ input: Buffer.from(svg), blend: "over" }])
    .jpeg({ quality: 88 })
    .toBuffer();
  // No catch — let errors propagate so callers know the watermark failed
}

export async function createWatermarkedThumbnail(input: Buffer, width = 320, height = 240): Promise<Buffer> {
  const resized = await sharp(input)
    .resize(width, height, { fit: "cover", withoutEnlargement: true })
    .jpeg({ quality: 74 })
    .toBuffer();

  return applyWatermark(resized);
}
