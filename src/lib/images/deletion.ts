export type ImageLifecycleStatus = "active" | "deletion_requested" | "archived" | "purged" | "legal_hold";
export type DeletionAction = "purge" | "archive";
export type DeletionRequesterRole = "admin" | "photographer";
export type DeletionReason =
  | "sold"
  | "onchain_registered"
  | "arweave_registered"
  | "public_listing";

export interface ImageDeletionInput {
  status?: string | null;
  sales_count?: number | null;
  proof_status?: string | null;
  proof_tx_hash?: string | null;
  proof_arweave_original_tx_id?: string | null;
  proof_arweave_metadata_tx_id?: string | null;
  proof_arweave_manifest_tx_id?: string | null;
}

export interface ImageDeletionContext {
  requesterRole: DeletionRequesterRole;
}

export interface ImageDeletionImpact {
  action: DeletionAction;
  lifecycleStatus: Extract<ImageLifecycleStatus, "archived" | "purged">;
  buyerNoticeRequired: boolean;
  onchainNoticeRequired: boolean;
  storagePurgeAllowed: boolean;
  reasons: DeletionReason[];
  estimatedFeeKrw: number;
}

const SIMPLE_PHOTOGRAPHER_DELETE_FEE_KRW = 5000;
const COMPLEX_PHOTOGRAPHER_DELETE_FEE_KRW = 30000;

function hasValue(value: string | null | undefined) {
  return Boolean(value && value.trim());
}

function hasOnchainProof(image: ImageDeletionInput) {
  return (
    image.proof_status === "registered" ||
    image.proof_status === "pending" ||
    hasValue(image.proof_tx_hash)
  );
}

function hasArweaveProof(image: ImageDeletionInput) {
  return (
    hasValue(image.proof_arweave_original_tx_id) ||
    hasValue(image.proof_arweave_metadata_tx_id) ||
    hasValue(image.proof_arweave_manifest_tx_id)
  );
}

export function defaultDeletionFeeKrw(impact: Pick<ImageDeletionImpact, "buyerNoticeRequired" | "onchainNoticeRequired">) {
  return impact.buyerNoticeRequired || impact.onchainNoticeRequired
    ? COMPLEX_PHOTOGRAPHER_DELETE_FEE_KRW
    : SIMPLE_PHOTOGRAPHER_DELETE_FEE_KRW;
}

export function assessImageDeletion(
  image: ImageDeletionInput,
  context: ImageDeletionContext,
): ImageDeletionImpact {
  const salesCount = Math.max(0, Number(image.sales_count ?? 0));
  const sold = salesCount > 0;
  const onchain = hasOnchainProof(image);
  const arweave = hasArweaveProof(image);
  const archiveRequired = sold || onchain || arweave;
  const reasons: DeletionReason[] = [];

  if (sold) reasons.push("sold");
  if (onchain) reasons.push("onchain_registered");
  if (arweave) reasons.push("arweave_registered");
  if (image.status === "approved" && !archiveRequired) reasons.push("public_listing");

  const impact: ImageDeletionImpact = {
    action: archiveRequired ? "archive" : "purge",
    lifecycleStatus: archiveRequired ? "archived" : "purged",
    buyerNoticeRequired: sold,
    onchainNoticeRequired: onchain || arweave,
    storagePurgeAllowed: !archiveRequired,
    reasons,
    estimatedFeeKrw: 0,
  };

  return {
    ...impact,
    estimatedFeeKrw: context.requesterRole === "photographer" ? defaultDeletionFeeKrw(impact) : 0,
  };
}

export function deletionImpactMessage(impact: ImageDeletionImpact) {
  if (impact.action === "purge") {
    return "판매 및 온체인 등록 이력이 없어 원본과 공개 미리보기를 완전삭제할 수 있습니다.";
  }

  const fragments = ["신규 판매와 공개 노출은 중단하고 이미지는 운영 보존용으로 아카이브합니다."];
  if (impact.buyerNoticeRequired) {
    fragments.push("기존 구매 이력에는 삭제/판매중지 안내가 표시됩니다.");
  }
  if (impact.onchainNoticeRequired) {
    fragments.push("온체인 또는 Arweave 증명 기록은 삭제하지 않고 철회/아카이브 상태로 보존합니다.");
  }
  return fragments.join(" ");
}
