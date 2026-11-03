const HASH_SIZE = 8;
const PHASH_SAMPLE_SIZE = 32;

export const PORTABLE_FINGERPRINT_ALGORITHM = "phash-dhash-jsquash-v2";

export interface PortableImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface PortableImageFingerprint {
  originalSha256: string;
  phash: string;
  dhash: string;
  width: number;
  height: number;
  algorithmVersion: typeof PORTABLE_FINGERPRINT_ALGORITHM;
}

type ResizeImage = (
  image: PortableImageData,
  width: number,
  height: number,
) => Promise<PortableImageData>;

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

function greyscale(image: PortableImageData) {
  const pixels = new Uint8Array(image.width * image.height);
  for (let source = 0, target = 0; source < image.data.length; source += 4, target += 1) {
    const alpha = image.data[source + 3] / 255;
    const red = image.data[source] * alpha + 255 * (1 - alpha);
    const green = image.data[source + 1] * alpha + 255 * (1 - alpha);
    const blue = image.data[source + 2] * alpha + 255 * (1 - alpha);
    pixels[target] = Math.round(red * 0.299 + green * 0.587 + blue * 0.114);
  }
  return pixels;
}

function rotateImage(image: PortableImageData, rotationDegrees: number): PortableImageData {
  const rotation = ((Math.round(rotationDegrees) % 360) + 360) % 360;
  if (rotation === 0) return image;
  if (rotation !== 90 && rotation !== 180 && rotation !== 270) return image;

  const width = rotation === 90 || rotation === 270 ? image.height : image.width;
  const height = rotation === 90 || rotation === 270 ? image.width : image.height;
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      let targetX = x;
      let targetY = y;
      if (rotation === 90) {
        targetX = image.height - 1 - y;
        targetY = x;
      } else if (rotation === 180) {
        targetX = image.width - 1 - x;
        targetY = image.height - 1 - y;
      } else if (rotation === 270) {
        targetX = y;
        targetY = image.width - 1 - x;
      }
      const source = (y * image.width + x) * 4;
      const target = (targetY * width + targetX) * 4;
      data.set(image.data.subarray(source, source + 4), target);
    }
  }

  return { data, width, height };
}

export async function createPortableImageFingerprint(input: {
  originalBytes: ArrayBuffer;
  decoded: PortableImageData;
  resize: ResizeImage;
  sha256: (bytes: ArrayBuffer) => Promise<string>;
  rotationDegrees?: number;
}): Promise<PortableImageFingerprint> {
  const oriented = rotateImage(input.decoded, input.rotationDegrees ?? 0);
  const [phashImage, dhashImage, originalSha256] = await Promise.all([
    input.resize(oriented, PHASH_SAMPLE_SIZE, PHASH_SAMPLE_SIZE),
    input.resize(oriented, HASH_SIZE + 1, HASH_SIZE),
    input.sha256(input.originalBytes),
  ]);

  return {
    originalSha256,
    phash: perceptualHash(greyscale(phashImage)),
    dhash: differenceHash(greyscale(dhashImage)),
    width: oriented.width,
    height: oriented.height,
    algorithmVersion: PORTABLE_FINGERPRINT_ALGORITHM,
  };
}
