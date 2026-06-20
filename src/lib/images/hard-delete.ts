export interface HardDeleteImageInput {
  id: string;
  title: string;
  status: string | null;
  lifecycle_status: string | null;
  is_published: boolean | null;
  sales_count: number | null;
  proof_status: string | null;
  proof_tx_hash: string | null;
  proof_arweave_original_tx_id: string | null;
  proof_arweave_metadata_tx_id: string | null;
  proof_arweave_manifest_tx_id: string | null;
}

export interface ImageReferenceCounts {
  orderItems: number;
  downloads: number;
  earningsLedger: number;
  deletionRequests: number;
  sourcingResults: number;
  subscriptionDownloads: number;
  arweaveFeeOrderItems: number;
  favorites: number;
  collectionItems: number;
  priceOverrides: number;
}

export interface HardDeleteEligibility {
  allowed: boolean;
  blockers: string[];
}

export function emptyImageReferenceCounts(): ImageReferenceCounts {
  return {
    orderItems: 0,
    downloads: 0,
    earningsLedger: 0,
    deletionRequests: 0,
    sourcingResults: 0,
    subscriptionDownloads: 0,
    arweaveFeeOrderItems: 0,
    favorites: 0,
    collectionItems: 0,
    priceOverrides: 0,
  };
}

function hasValue(value: string | null | undefined) {
  return Boolean(value && value.trim());
}

export function hasOnchainOrArweaveRecord(image: HardDeleteImageInput) {
  return (
    image.proof_status === "registered" ||
    image.proof_status === "pending" ||
    hasValue(image.proof_tx_hash) ||
    hasValue(image.proof_arweave_original_tx_id) ||
    hasValue(image.proof_arweave_metadata_tx_id) ||
    hasValue(image.proof_arweave_manifest_tx_id)
  );
}

export function assessHardDeleteEligibility(
  image: HardDeleteImageInput,
  counts: ImageReferenceCounts,
): HardDeleteEligibility {
  const blockers: string[] = [];
  const lifecycle = image.lifecycle_status ?? "active";

  if (lifecycle === "legal_hold") blockers.push("legal_hold");
  else if (lifecycle !== "active") blockers.push("not_active");

  if (Number(image.sales_count ?? 0) > 0) blockers.push("sales");
  if (hasOnchainOrArweaveRecord(image)) blockers.push("onchain_or_arweave");
  if (counts.orderItems > 0) blockers.push("order_items");
  if (counts.downloads > 0) blockers.push("downloads");
  if (counts.earningsLedger > 0) blockers.push("earnings_ledger");
  if (counts.deletionRequests > 0) blockers.push("deletion_requests");
  if (counts.sourcingResults > 0) blockers.push("sourcing_results");
  if (counts.subscriptionDownloads > 0) blockers.push("subscription_downloads");
  if (counts.arweaveFeeOrderItems > 0) blockers.push("arweave_fee_orders");

  return {
    allowed: blockers.length === 0,
    blockers,
  };
}

export function sumReferenceCounts(counts: ImageReferenceCounts) {
  return Object.values(counts).reduce((sum, value) => sum + Number(value ?? 0), 0);
}
