import "server-only";

import { detachImageFromAboutPage } from "@/lib/about/library-assets";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assessHardDeleteEligibility,
  assessPhotographerFinalDeleteEligibility,
  emptyImageReferenceCounts,
  type HardDeleteEligibility,
  type HardDeleteImageInput,
  type ImageReferenceCounts,
} from "./hard-delete";

export interface HardDeleteImageRow extends HardDeleteImageInput {
  asset_id: string | null;
  title: string;
  photographer_id: string | null;
  storage_path_preview: string | null;
  storage_path_analysis: string | null;
  storage_path_full: string | null;
  storage_path_original: string | null;
  original_filename: string | null;
  file_size_mb: number | null;
  width: number | null;
  height: number | null;
  created_at: string;
  photographer?: { full_name: string | null } | { full_name: string | null }[] | null;
}

export interface HardDeleteCandidate {
  image: HardDeleteImageRow;
  referenceCounts: ImageReferenceCounts;
  eligibility: HardDeleteEligibility;
}

export type HardDeleteKind = "beta_cleanup" | "admin_hard_delete" | "photographer_request";

export interface HardDeletePurgeOptions {
  deletedBy: string | null;
  deleteKind: HardDeleteKind;
  reason: string;
}

export interface HardDeletePurgeResult {
  imageId: string;
  assetId: string | null;
  title: string;
  purged: boolean;
  blockers: string[];
  errors: string[];
  storageRemoved?: number;
  storagePaths?: ReturnType<typeof storagePathsForHardDelete>;
  referenceCounts?: ImageReferenceCounts;
}

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export function photographerName(image: HardDeleteImageRow) {
  return first(image.photographer)?.full_name ?? null;
}

async function exactCount(
  admin: ReturnType<typeof createAdminClient>,
  table: string,
  column: string,
  imageId: string,
) {
  const { count, error } = await admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, imageId);
  if (error) throw error;
  return count ?? 0;
}

async function countViaOrderItems(
  admin: ReturnType<typeof createAdminClient>,
  table: "downloads" | "earnings_ledger",
  imageId: string,
) {
  const { count, error } = await admin
    .from(table)
    .select("id, order_items!inner(image_id)", { count: "exact", head: true })
    .eq("order_items.image_id", imageId);
  if (error) throw error;
  return count ?? 0;
}

export async function getImageReferenceCounts(
  admin: ReturnType<typeof createAdminClient>,
  imageId: string,
): Promise<ImageReferenceCounts> {
  const counts = emptyImageReferenceCounts();
  const [
    orderItems,
    downloads,
    earningsLedger,
    deletionRequests,
    sourcingResults,
    subscriptionDownloads,
    arweaveFeeOrderItems,
    favorites,
    collectionItems,
    priceOverrides,
  ] = await Promise.all([
    exactCount(admin, "order_items", "image_id", imageId),
    countViaOrderItems(admin, "downloads", imageId),
    countViaOrderItems(admin, "earnings_ledger", imageId),
    exactCount(admin, "image_deletion_requests", "image_id", imageId),
    exactCount(admin, "sourcing_request_results", "image_id", imageId),
    exactCount(admin, "subscription_downloads", "image_id", imageId),
    exactCount(admin, "arweave_registration_fee_order_items", "image_id", imageId),
    exactCount(admin, "favorites", "image_id", imageId),
    exactCount(admin, "collection_items", "image_id", imageId),
    exactCount(admin, "image_price_overrides", "image_id", imageId),
  ]);

  return {
    ...counts,
    orderItems,
    downloads,
    earningsLedger,
    deletionRequests,
    sourcingResults,
    subscriptionDownloads,
    arweaveFeeOrderItems,
    favorites,
    collectionItems,
    priceOverrides,
  };
}

export async function attachHardDeleteEligibility(
  admin: ReturnType<typeof createAdminClient>,
  image: HardDeleteImageRow,
): Promise<HardDeleteCandidate> {
  const referenceCounts = await getImageReferenceCounts(admin, image.id);
  return {
    image,
    referenceCounts,
    eligibility: assessHardDeleteEligibility(image, referenceCounts),
  };
}

export async function attachPhotographerFinalDeleteEligibility(
  admin: ReturnType<typeof createAdminClient>,
  image: HardDeleteImageRow,
): Promise<HardDeleteCandidate> {
  const referenceCounts = await getImageReferenceCounts(admin, image.id);
  return {
    image,
    referenceCounts,
    eligibility: assessPhotographerFinalDeleteEligibility(image, referenceCounts),
  };
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export function storagePathsForHardDelete(image: HardDeleteImageRow) {
  return {
    originals: uniqueStrings([image.storage_path_original, image.storage_path_full]),
    previews: uniqueStrings([
      image.storage_path_preview,
      image.storage_path_preview ? `thumbs/${image.storage_path_preview}` : null,
    ]),
    analysis: uniqueStrings([image.storage_path_analysis]),
  };
}

export async function removeHardDeleteStorageFiles(
  admin: ReturnType<typeof createAdminClient>,
  image: HardDeleteImageRow,
) {
  const paths = storagePathsForHardDelete(image);
  const errors: string[] = [];
  let removed = 0;

  try {
    await detachImageFromAboutPage(admin, image.id);
  } catch (error) {
    errors.push(`about-page: ${error instanceof Error ? error.message : "회사소개 이미지 분리 실패"}`);
  }

  if (paths.originals.length > 0) {
    const { error } = await admin.storage.from("images-original").remove(paths.originals);
    if (error) errors.push(`original: ${error.message}`);
    else removed += paths.originals.length;
  }

  if (paths.previews.length > 0) {
    const { error } = await admin.storage.from("images-preview").remove(paths.previews);
    if (error) errors.push(`preview: ${error.message}`);
    else removed += paths.previews.length;
  }

  if (paths.analysis.length > 0) {
    const { error } = await admin.storage.from("images-analysis").remove(paths.analysis);
    if (error) errors.push(`analysis: ${error.message}`);
    else removed += paths.analysis.length;
  }

  return { paths, errors, removed };
}

export async function deleteSafeDependentRows(
  admin: ReturnType<typeof createAdminClient>,
  imageId: string,
) {
  await Promise.all([
    admin.from("favorites").delete().eq("image_id", imageId),
    admin.from("collection_items").delete().eq("image_id", imageId),
    admin.from("image_price_overrides").delete().eq("image_id", imageId),
  ]);
}

export async function purgeHardDeleteImage(
  admin: ReturnType<typeof createAdminClient>,
  candidate: HardDeleteCandidate,
  options: HardDeletePurgeOptions,
): Promise<HardDeletePurgeResult> {
  const { image } = candidate;
  if (!candidate.eligibility.allowed) {
    return {
      imageId: image.id,
      assetId: image.asset_id,
      title: image.title,
      purged: false,
      blockers: candidate.eligibility.blockers,
      errors: ["hard_delete_not_allowed"],
      referenceCounts: candidate.referenceCounts,
    };
  }

  const storage = await removeHardDeleteStorageFiles(admin, image);
  if (storage.errors.length > 0) {
    return {
      imageId: image.id,
      assetId: image.asset_id,
      title: image.title,
      purged: false,
      blockers: [],
      errors: storage.errors,
      storagePaths: storage.paths,
      referenceCounts: candidate.referenceCounts,
    };
  }

  await deleteSafeDependentRows(admin, image.id);

  const logRow = {
    image_id: image.id,
    asset_id: image.asset_id,
    title: image.title,
    photographer_id: image.photographer_id,
    photographer_name: photographerName(image),
    deleted_by: options.deletedBy,
    delete_kind: options.deleteKind,
    delete_reason: options.reason,
    status_snapshot: image.status,
    lifecycle_status_snapshot: image.lifecycle_status,
    is_published_snapshot: image.is_published,
    storage_paths_snapshot: storage.paths,
    reference_counts_snapshot: candidate.referenceCounts,
    image_created_at: image.created_at,
    purged_at: new Date().toISOString(),
  };

  const { error: logError } = await admin.from("image_purge_logs").insert(logRow);
  if (logError) {
    return {
      imageId: image.id,
      assetId: image.asset_id,
      title: image.title,
      purged: false,
      blockers: [],
      errors: [`purge_log: ${logError.message}`],
      storagePaths: storage.paths,
      referenceCounts: candidate.referenceCounts,
    };
  }

  const { error: deleteError } = await admin.from("images").delete().eq("id", image.id);
  if (deleteError) {
    return {
      imageId: image.id,
      assetId: image.asset_id,
      title: image.title,
      purged: false,
      blockers: [],
      errors: [`image: ${deleteError.message}`],
      storagePaths: storage.paths,
      referenceCounts: candidate.referenceCounts,
    };
  }

  return {
    imageId: image.id,
    assetId: image.asset_id,
    title: image.title,
    purged: true,
    blockers: [],
    errors: [],
    storageRemoved: storage.removed,
    storagePaths: storage.paths,
    referenceCounts: candidate.referenceCounts,
  };
}
