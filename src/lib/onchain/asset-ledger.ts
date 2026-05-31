import { imageAssetBytes32 } from "./ids";

export function imageLedgerKey(assetId: string | null | undefined, storedOnchainAssetId?: string | null) {
  if (storedOnchainAssetId?.trim()) return storedOnchainAssetId;
  if (!assetId?.trim()) return null;
  return imageAssetBytes32(assetId);
}
