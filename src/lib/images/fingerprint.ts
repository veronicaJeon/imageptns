import { createHash } from "node:crypto";
import sharp from "sharp";
import { normalizeRotationDegrees } from "./orientation";

const HASH_SIZE = 8;
const PHASH_SAMPLE_SIZE = 32;

export interface ImageFingerprint {
  originalSha256: string;
  phash: string;
  dhash: string;
  width: number;
  height: number;
  algorithmVersion: string;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function dctCoefficient(pixels: Uint8Array, u: number, v: number) {
  let sum = 0;
  for (let y = 0; y < PHASH_SAMPLE_SIZE; y += 1) {
    for (let x = 0; x < PHASH_SAMPLE_SIZE; x += 1) {
      sum += pixels[y * PHASH_SAMPLE_SIZE + x]
        * Math.cos(((2 * x + 1) * u * Math.PI) / (2 * PHASH_SAMPLE_SIZE))
        * Math.cos(((2 * y + 1) * v * Math.PI) / (2 * PHASH_SAMPLE_SIZE));
    }
  }
  return sum;
}

function perceptualHash(pixels: Uint8Array) {
  const coefficients: number[] = [];
  for (let v = 0; v < HASH_SIZE; v += 1) {
    for (let u = 0; u < HASH_SIZE; u += 1) {
      coefficients.push(dctCoefficient(pixels, u, v));
    }
  }
  const threshold = median(coefficients.slice(1));
  return coefficients.map((value, index) => index === 0 || value >= threshold ? "1" : "0").join("");
}

function differenceHash(pixels: Uint8Array) {
  let result = "";
  for (let y = 0; y < HASH_SIZE; y += 1) {
    for (let x = 0; x < HASH_SIZE; x += 1) {
      result += pixels[y * (HASH_SIZE + 1) + x] > pixels[y * (HASH_SIZE + 1) + x + 1] ? "1" : "0";
    }
  }
  return result;
}

export function hammingDistance(left: string, right: string) {
  if (left.length !== right.length) throw new Error("Hashes must have the same length");
  let distance = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) distance += 1;
  }
  return distance;
}

export async function createImageFingerprint(
  input: Buffer,
  rotationDegrees: unknown = 0,
): Promise<ImageFingerprint> {
  const rotation = normalizeRotationDegrees(rotationDegrees);
  const metadata = await sharp(input).metadata();
  const autoWidth = metadata.autoOrient.width;
  const autoHeight = metadata.autoOrient.height;
  if (!autoWidth || !autoHeight) throw new Error("Image dimensions are unavailable");
  const swapsDimensions = rotation === 90 || rotation === 270;

  const phashPixels = await sharp(input).rotate().rotate(rotation)
      .resize(PHASH_SAMPLE_SIZE, PHASH_SAMPLE_SIZE, { fit: "fill" })
      .greyscale()
      .raw()
      .toBuffer();
  const dhashPixels = await sharp(input).rotate().rotate(rotation)
      .resize(HASH_SIZE + 1, HASH_SIZE, { fit: "fill" })
      .greyscale()
      .raw()
      .toBuffer();

  return {
    originalSha256: createHash("sha256").update(input).digest("hex"),
    phash: perceptualHash(phashPixels),
    dhash: differenceHash(dhashPixels),
    width: swapsDimensions ? autoHeight : autoWidth,
    height: swapsDimensions ? autoWidth : autoHeight,
    algorithmVersion: "phash-dhash-v1",
  };
}
