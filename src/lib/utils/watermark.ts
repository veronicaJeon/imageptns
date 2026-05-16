import sharp from "sharp";

export async function applyWatermark(input: Buffer): Promise<Buffer> {
  try {
    const image = sharp(input);
    const { width = 800, height = 600 } = await image.metadata();

    const fontSize = Math.max(24, Math.round((width ?? 800) * 0.04));
    const svgWidth = width ?? 800;
    const svgHeight = height ?? 600;

    const svg = `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  <text
    x="50%"
    y="50%"
    font-family="Arial, Helvetica, sans-serif"
    font-size="${fontSize}"
    font-weight="bold"
    fill="white"
    fill-opacity="0.30"
    text-anchor="middle"
    dominant-baseline="middle"
    letter-spacing="${Math.round(fontSize * 0.15)}"
  >IMAGE PARTNERS</text>
</svg>`;

    return await image
      .composite([{ input: Buffer.from(svg), blend: "over" }])
      .jpeg({ quality: 88 })
      .toBuffer();
  } catch {
    return input;
  }
}
