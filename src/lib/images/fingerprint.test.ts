import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { createImageFingerprint, hammingDistance } from "./fingerprint";

async function sampleImage(colour: string) {
  const tint = Number.parseInt(colour.slice(1, 3), 16);
  const pixels = Buffer.alloc(160 * 100 * 3);
  for (let y = 0; y < 100; y += 1) {
    for (let x = 0; x < 160; x += 1) {
      const offset = (y * 160 + x) * 3;
      pixels[offset] = (x * 3 + y + tint) % 256;
      pixels[offset + 1] = (x + y * 4 + tint) % 256;
      pixels[offset + 2] = (x * 2 + y * 2 + tint) % 256;
    }
  }
  return sharp(pixels, { raw: { width: 160, height: 100, channels: 3 } })
    .composite([{ input: Buffer.from('<svg width="160" height="100"><circle cx="50" cy="50" r="28" fill="white"/><rect x="95" y="20" width="40" height="60" fill="black"/></svg>') }])
    .jpeg({ quality: 92 })
    .toBuffer();
}

describe("image fingerprints", () => {
  it("keeps the original digest exact while visual hashes survive re-encoding", async () => {
    const original = await sampleImage("#336699");
    const reencoded = await sharp(original).png().toBuffer();
    const [first, second] = await Promise.all([
      createImageFingerprint(original),
      createImageFingerprint(reencoded),
    ]);

    expect(first.originalSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(first.originalSha256).not.toBe(second.originalSha256);
    expect(first.phash).toMatch(/^[01]{64}$/);
    expect(first.dhash).toMatch(/^[01]{64}$/);
    expect(hammingDistance(first.phash, second.phash)).toBeLessThanOrEqual(12);
    expect(hammingDistance(first.dhash, second.dhash)).toBeLessThanOrEqual(4);
  });

  it("returns zero distance for identical hashes", () => {
    expect(hammingDistance("0101", "0101")).toBe(0);
  });

  it("records dimensions after the photographer rotation correction", async () => {
    const result = await createImageFingerprint(await sampleImage("#335577"), 90);
    expect(result.width).toBe(100);
    expect(result.height).toBe(160);
  });
});
