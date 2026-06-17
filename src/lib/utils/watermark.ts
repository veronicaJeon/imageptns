import sharp from "sharp";
import { normalizeRotationDegrees } from "../images/orientation";

const GLYPHS: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  " ": ["000", "000", "000", "000", "000", "000", "000"],
};

function pixelTextRects(text: string, x: number, y: number, unit: number, opacity: number) {
  let cursor = x;
  const rects: string[] = [];
  for (const char of text.toUpperCase()) {
    const glyph = GLYPHS[char] ?? GLYPHS[" "];
    glyph.forEach((row, rowIndex) => {
      [...row].forEach((pixel, colIndex) => {
        if (pixel !== "1") return;
        rects.push(
          `<rect x="${cursor + colIndex * unit}" y="${y + rowIndex * unit}" width="${unit}" height="${unit}" rx="${unit * 0.16}" fill="white" fill-opacity="${opacity}"/>`,
        );
      });
    });
    cursor += (glyph[0].length + 1) * unit;
  }
  return rects.join("");
}

function pixelTextWidth(text: string, unit: number) {
  return [...text.toUpperCase()].reduce((width, char) => {
    const glyph = GLYPHS[char] ?? GLYPHS[" "];
    return width + (glyph[0].length + 1) * unit;
  }, 0);
}

function watermarkSvg(w: number, h: number) {
  const label = "IMAGE PARTNERS";
  const unit = Math.max(3, Math.min(14, Math.round(Math.min(w, h) * 0.008)));
  const labelWidth = pixelTextWidth(label, unit);
  const labelHeight = 7 * unit;
  const smallUnit = Math.max(2, Math.round(unit * 0.42));
  const smallLabel = "IMAGE PARTNERS";
  const smallWidth = pixelTextWidth(smallLabel, smallUnit);
  const safePadding = Math.max(12, Math.round(Math.min(w, h) * 0.025));

  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${w}" height="${h}" fill="transparent"/>
    <g transform="rotate(-24 ${w / 2} ${h / 2})">
      ${pixelTextRects(label, (w - labelWidth) / 2, (h - labelHeight) / 2, unit, 0.26)}
    </g>
    <g>
      ${pixelTextRects(smallLabel, w - safePadding - smallWidth, h - safePadding - 7 * smallUnit, smallUnit, 0.72)}
    </g>
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
  return sharp(input)
    .rotate()
    .resize(width, height, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 74 })
    .toBuffer();
}
