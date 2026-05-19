import { createHash } from "crypto";
import { keccak256, stringToHex, type Hex } from "viem";

export interface ImageProofInput {
  assetId: string;
  photographerId: string;
  title: string;
  storagePathOriginal: string;
  originalFileSha256: string;
}

export function sha256Buffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function canonicalImageProofHash(input: ImageProofInput): Hex {
  const payload = JSON.stringify({
    assetId: input.assetId,
    photographerId: input.photographerId,
    storagePathOriginal: input.storagePathOriginal,
    title: input.title,
    originalFileSha256: input.originalFileSha256,
  });
  return keccak256(stringToHex(payload));
}
