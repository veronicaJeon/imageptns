import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { applyWatermark, createWatermarkedThumbnail } from "./watermark";

async function sampleImage(width: number, height: number) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: "#335577",
    },
  })
    .jpeg()
    .toBuffer();
}

describe("watermark utilities", () => {
  it("keeps the original dimensions for full-size watermarked previews", async () => {
    const input = await sampleImage(300, 900);
    const output = await applyWatermark(input);
    const metadata = await sharp(output).metadata();

    expect(metadata.width).toBe(300);
    expect(metadata.height).toBe(900);
  });

  it("keeps tall thumbnails uncropped by fitting inside the requested box", async () => {
    const input = await sampleImage(300, 900);
    const output = await createWatermarkedThumbnail(input, 320, 240);
    const metadata = await sharp(output).metadata();

    expect(metadata.width).toBe(80);
    expect(metadata.height).toBe(240);
  });
});
