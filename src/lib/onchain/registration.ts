export type ImageProofStatus =
  | "not_registered"
  | "available"
  | "requested"
  | "pending"
  | "registered"
  | "failed";

export type BlockchainRegistrationState =
  | "not_approved"
  | "waiting_first_sale"
  | "self_funded_available"
  | "self_funded_payment_pending"
  | ImageProofStatus;

export type AuthorshipDeclaration = "ai_generated" | "human_original";

export type ProofRequestKind = "post_sale" | "self_funded";
export type ProofRequestPaymentStatus = "none" | "pending" | "paid" | "refunded";

export interface RegistrationStateInput {
  imageStatus: string | null;
  salesCount: number | null | undefined;
  proofStatus: string | null | undefined;
  proofRequestKind?: string | null | undefined;
  proofRequestPaymentStatus?: string | null | undefined;
}

export interface RegistrationSelectionItem {
  id: string;
  fileSizeMb: number | null | undefined;
}

export interface ArweaveCredentialMetadataInput {
  appName: string;
  assetId: string;
  imageId: string;
  photographerId: string;
  title: string;
  originalFilename?: string | null;
  originalFileSha256: string;
  fileSizeBytes: number;
  contentType: string;
  storagePathOriginal: string;
  copyrightLicense: string;
  freeUsagePolicy: string;
  authorshipDeclaration: AuthorshipDeclaration;
  arweaveOriginalTxId: string;
  contentHash?: string;
  onchainAssetId?: string;
  ledgerKey?: string;
  createdAt: string;
}

export interface ArweaveCredentialMetadata extends ArweaveCredentialMetadataInput {
  schema: "imagepartners.photo-credential.v1";
}

const TERMINAL_OR_ACTIVE_STATUSES = new Set([
  "requested",
  "pending",
  "registered",
  "failed",
]);

export function normalizeProofStatus(value: string | null | undefined): ImageProofStatus {
  if (
    value === "available" ||
    value === "requested" ||
    value === "pending" ||
    value === "registered" ||
    value === "failed"
  ) {
    return value;
  }

  return "not_registered";
}

export function getBlockchainRegistrationState(
  input: RegistrationStateInput,
): BlockchainRegistrationState {
  if (input.imageStatus !== "approved") return "not_approved";

  const proofStatus = normalizeProofStatus(input.proofStatus);
  if (TERMINAL_OR_ACTIVE_STATUSES.has(proofStatus)) return proofStatus;
  if (proofStatus === "available") return "available";

  if ((input.salesCount ?? 0) > 0) return "available";

  if (input.proofRequestPaymentStatus === "pending") return "self_funded_payment_pending";

  return "self_funded_available";
}

export function canRequestBlockchainRegistration(input: RegistrationStateInput): boolean {
  const state = getBlockchainRegistrationState(input);
  return state === "available" || state === "self_funded_available" || state === "failed";
}

/**
 * Photographer free (platform-funded, post-sale) request path.
 * Self-funded (pre-sale) images must go through the paid fee flow instead.
 */
export function canRequestFreeRegistration(input: RegistrationStateInput): boolean {
  const state = getBlockchainRegistrationState(input);
  return state === "available" || state === "failed";
}

/**
 * Admin may only register an image when it is in a requestable proof state, and
 * — for self-funded (photographer-paid) requests — only once the fee is paid.
 */
export function canAdminRegisterImage(input: {
  proofStatus: string | null | undefined;
  proofRequestKind?: string | null | undefined;
  proofRequestPaymentStatus?: string | null | undefined;
}): boolean {
  const proofStatus = normalizeProofStatus(input.proofStatus);
  if (!["requested", "available", "failed"].includes(proofStatus)) return false;
  if (input.proofRequestKind === "self_funded") {
    return input.proofRequestPaymentStatus === "paid";
  }
  return true;
}

export function summarizeRegistrationSelection(items: RegistrationSelectionItem[]) {
  const totalMb = items.reduce((sum, item) => sum + (Number(item.fileSizeMb) || 0), 0);
  const totalBytes = Math.round(totalMb * 1024 * 1024);

  return {
    count: items.length,
    totalBytes,
    totalMb: Number(totalMb.toFixed(2)),
  };
}

function requireSha256(value: string) {
  if (!/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error("originalFileSha256 must be a 64-character SHA-256 hash");
  }
}

export function buildArweaveCredentialMetadata(
  input: ArweaveCredentialMetadataInput,
): ArweaveCredentialMetadata {
  requireSha256(input.originalFileSha256);

  return {
    schema: "imagepartners.photo-credential.v1",
    ...input,
  };
}
