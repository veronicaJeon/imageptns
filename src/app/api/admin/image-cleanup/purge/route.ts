import { NextRequest, NextResponse } from "next/server";
import { KO_SERVICE_TERMS } from "@/lib/ux/terminology";
import { recordAdminAuditLog } from "@/lib/admin/audit";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import {
  attachHardDeleteEligibility,
  deleteSafeDependentRows,
  photographerName,
  removeHardDeleteStorageFiles,
  storagePathsForHardDelete,
  type HardDeleteImageRow,
} from "@/lib/images/hard-delete-server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_PURGE = 50;
const CONFIRMATION_TEXT = KO_SERVICE_TERMS.permanentDeletion;

function normalizeDeleteKind(value: unknown) {
  if (value === "beta_cleanup" || value === "admin_hard_delete" || value === "photographer_request") {
    return value;
  }
  return "beta_cleanup";
}

export async function POST(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const body = await req.json().catch(() => null) as {
    imageIds?: unknown;
    reason?: unknown;
    deleteKind?: unknown;
    confirmation?: unknown;
  } | null;

  if (body?.confirmation !== CONFIRMATION_TEXT) {
    return NextResponse.json({ error: "확인 문구가 일치하지 않습니다." }, { status: 400 });
  }

  const imageIds = Array.isArray(body?.imageIds)
    ? body.imageIds.filter((id): id is string => typeof id === "string")
    : [];
  const uniqueIds = Array.from(new Set(imageIds)).slice(0, MAX_PURGE);
  if (uniqueIds.length === 0) {
    return NextResponse.json({ error: "imageIds required" }, { status: 400 });
  }

  const reason = typeof body?.reason === "string" && body.reason.trim()
    ? body.reason.trim()
    : "베타 테스트 이미지 정리";
  const deleteKind = normalizeDeleteKind(body?.deleteKind);
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("images")
    .select(`
      id, asset_id, title, status, lifecycle_status, is_published,
      photographer_id, storage_path_preview, storage_path_analysis, storage_path_full, storage_path_original, original_filename,
      file_size_mb, width, height, sales_count, proof_status, proof_tx_hash,
      proof_arweave_original_tx_id, proof_arweave_metadata_tx_id, proof_arweave_manifest_tx_id,
      proof_arweave_confirmed_at, created_at,
      photographer:profiles!photographer_id(full_name)
    `)
    .in("id", uniqueIds);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const foundImages = (data ?? []) as HardDeleteImageRow[];
  const results = [];

  for (const image of foundImages) {
    const assessed = await attachHardDeleteEligibility(admin, image);
    if (!assessed.eligibility.allowed) {
      results.push({
        imageId: image.id,
        assetId: image.asset_id,
        title: image.title,
        purged: false,
        blockers: assessed.eligibility.blockers,
        errors: ["hard_delete_not_allowed"],
      });
      continue;
    }

    const storagePaths = storagePathsForHardDelete(image);
    const storage = await removeHardDeleteStorageFiles(admin, image);
    if (storage.errors.length > 0) {
      results.push({
        imageId: image.id,
        assetId: image.asset_id,
        title: image.title,
        purged: false,
        blockers: [],
        errors: storage.errors,
      });
      continue;
    }

    await deleteSafeDependentRows(admin, image.id);

    const logRow = {
      image_id: image.id,
      asset_id: image.asset_id,
      title: image.title,
      photographer_id: image.photographer_id,
      photographer_name: photographerName(image),
      deleted_by: adminUser.id,
      delete_kind: deleteKind,
      delete_reason: reason,
      status_snapshot: image.status,
      lifecycle_status_snapshot: image.lifecycle_status,
      is_published_snapshot: image.is_published,
      storage_paths_snapshot: storagePaths,
      reference_counts_snapshot: assessed.referenceCounts,
      image_created_at: image.created_at,
      purged_at: new Date().toISOString(),
    };

    const { error: logError } = await admin.from("image_purge_logs").insert(logRow);
    if (logError) {
      results.push({
        imageId: image.id,
        assetId: image.asset_id,
        title: image.title,
        purged: false,
        blockers: [],
        errors: [`purge_log: ${logError.message}`],
      });
      continue;
    }

    const { error: deleteError } = await admin.from("images").delete().eq("id", image.id);
    if (deleteError) {
      results.push({
        imageId: image.id,
        assetId: image.asset_id,
        title: image.title,
        purged: false,
        blockers: [],
        errors: [`image: ${deleteError.message}`],
      });
      continue;
    }

    await recordAdminAuditLog(admin, {
      actorId: adminUser.id,
      action: "image.hard_purged",
      targetType: "image",
      targetId: image.id,
      targetLabel: image.asset_id ?? image.title,
      before: image as unknown as Record<string, unknown>,
      after: {
        deleteKind,
        storagePaths,
        referenceCounts: assessed.referenceCounts,
        storageRemoved: storage.removed,
      },
      reason,
    });

    results.push({
      imageId: image.id,
      assetId: image.asset_id,
      title: image.title,
      purged: true,
      blockers: [],
      errors: [],
      storageRemoved: storage.removed,
    });
  }

  return NextResponse.json({
    results,
    summary: {
      requested: uniqueIds.length,
      found: foundImages.length,
      purged: results.filter((result) => result.purged).length,
      failed: results.filter((result) => !result.purged).length,
    },
  });
}
