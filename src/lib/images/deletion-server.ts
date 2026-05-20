import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  assessImageDeletion,
  deletionImpactMessage,
  type DeletionRequesterRole,
  type ImageDeletionImpact,
} from "./deletion";

export interface ImageDeletionRow {
  id: string;
  asset_id: string | null;
  title: string;
  status: string | null;
  storage_path_preview: string | null;
  storage_path_full: string | null;
  storage_path_original: string | null;
  original_filename: string | null;
  sales_count: number | null;
  proof_status: string | null;
  proof_tx_hash: string | null;
  proof_arweave_original_tx_id: string | null;
  proof_arweave_metadata_tx_id: string | null;
  proof_arweave_manifest_tx_id: string | null;
}

export interface ImageDeletionResult {
  imageId: string;
  assetId: string | null;
  title: string;
  action: ImageDeletionImpact["action"];
  lifecycleStatus: ImageDeletionImpact["lifecycleStatus"];
  notice: string;
  storageRemoved: boolean;
  errors: string[];
  impact: ImageDeletionImpact;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

async function removeStorageFiles(
  admin: ReturnType<typeof createAdminClient>,
  image: ImageDeletionRow,
) {
  const errors: string[] = [];
  let removed = false;

  const originalPaths = uniqueStrings([image.storage_path_original, image.storage_path_full]);
  if (originalPaths.length > 0) {
    const { error } = await admin.storage.from("images-original").remove(originalPaths);
    if (error) errors.push(`original: ${error.message}`);
    else removed = true;
  }

  const previewPaths = uniqueStrings([
    image.storage_path_preview,
    image.storage_path_preview ? `thumbs/${image.storage_path_preview}` : null,
  ]);
  if (previewPaths.length > 0) {
    const { error } = await admin.storage.from("images-preview").remove(previewPaths);
    if (error) errors.push(`preview: ${error.message}`);
    else removed = true;
  }

  return { removed, errors };
}

export async function applyImageDeletion(
  admin: ReturnType<typeof createAdminClient>,
  image: ImageDeletionRow,
  options: {
    actorId: string;
    requesterRole: DeletionRequesterRole;
    reason: string;
    adminNote?: string | null;
    chargedFeeKrw?: number;
    feeStatus?: "none" | "quoted" | "waived" | "pending" | "paid" | "failed";
  },
): Promise<ImageDeletionResult> {
  const now = new Date().toISOString();
  const impact = assessImageDeletion(image, { requesterRole: options.requesterRole });
  const notice = deletionImpactMessage(impact);
  const storage = impact.storagePurgeAllowed
    ? await removeStorageFiles(admin, image)
    : { removed: false, errors: [] };

  if (impact.buyerNoticeRequired) {
    await admin
      .from("order_items")
      .update({
        image_title_snapshot: image.title,
        image_asset_id_snapshot: image.asset_id,
        image_preview_path_snapshot: image.storage_path_preview,
        image_original_path_snapshot: image.storage_path_original ?? image.storage_path_full,
        image_original_filename_snapshot: image.original_filename,
        image_lifecycle_status: impact.lifecycleStatus,
        image_deleted_at: now,
        image_deletion_notice: notice,
      })
      .eq("image_id", image.id);
  }

  const patch: Record<string, unknown> = {
    lifecycle_status: impact.lifecycleStatus,
    deleted_at: now,
    deleted_by: options.actorId,
    deletion_reason: options.reason,
    deletion_reviewed_by: options.actorId,
    deletion_reviewed_at: now,
    deletion_admin_note: options.adminNote ?? null,
    deletion_fee_krw: options.chargedFeeKrw ?? impact.estimatedFeeKrw,
    deletion_fee_status: options.feeStatus ?? (impact.estimatedFeeKrw > 0 ? "pending" : "none"),
    updated_at: now,
  };

  if (impact.lifecycleStatus === "archived") patch.archived_at = now;
  if (impact.lifecycleStatus === "purged") {
    patch.purged_at = now;
    patch.status = "rejected";
    patch.rejection_reason = "Deleted by admin policy";
    patch.storage_path_preview = null;
    patch.storage_path_full = null;
    patch.storage_path_original = null;
  }

  const { error } = await admin
    .from("images")
    .update(patch)
    .eq("id", image.id);

  if (error) storage.errors.push(`image: ${error.message}`);

  return {
    imageId: image.id,
    assetId: image.asset_id,
    title: image.title,
    action: impact.action,
    lifecycleStatus: impact.lifecycleStatus,
    notice,
    storageRemoved: storage.removed,
    errors: storage.errors,
    impact,
  };
}
