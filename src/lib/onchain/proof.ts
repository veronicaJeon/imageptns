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

function requireNonEmptyString(value: string, name: string): void {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
}

function requireSha256(value: string, name: string): void {
  if (!/^[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${name} must be a 64-character hex SHA-256 hash`);
}

export function canonicalImageProofHash(input: ImageProofInput): Hex {
  requireNonEmptyString(input.assetId, "assetId");
  requireNonEmptyString(input.photographerId, "photographerId");
  requireNonEmptyString(input.title, "title");
  requireNonEmptyString(input.storagePathOriginal, "storagePathOriginal");
  requireSha256(input.originalFileSha256, "originalFileSha256");

  const payload = JSON.stringify({
    assetId: input.assetId,
    photographerId: input.photographerId,
    storagePathOriginal: input.storagePathOriginal,
    title: input.title,
    originalFileSha256: input.originalFileSha256,
  });
  return keccak256(stringToHex(payload));
}
