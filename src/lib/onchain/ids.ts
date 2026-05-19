import { keccak256, stringToHex, type Hex } from "viem";

export function imageAssetBytes32(assetId: string): Hex {
  if (!assetId.trim()) throw new Error("assetId is required");
  return keccak256(stringToHex(`imageptns:image:${assetId}`));
}

export function orderBytes32(orderId: string): Hex {
  if (!orderId.trim()) throw new Error("orderId is required");
  return keccak256(stringToHex(`imageptns:order:${orderId}`));
}
