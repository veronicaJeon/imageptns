import { NextRequest, NextResponse } from "next/server";
import { recordAdminAuditLog } from "@/lib/admin/audit";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { applyAdminImageDeleteTargetFilter } from "@/lib/images/admin-delete";
import { applyImageDeletion, type ImageDeletionRow } from "@/lib/images/deletion-server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_DELETE = 50;

export async function POST(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const body = await req.json().catch(() => null) as {
    imageIds?: unknown;
    reason?: unknown;
  } | null;

  const imageIds = Array.isArray(body?.imageIds)
    ? body.imageIds.filter((id): id is string => typeof id === "string")
    : [];
  const uniqueIds = Array.from(new Set(imageIds)).slice(0, MAX_DELETE);
  if (uniqueIds.length === 0) {
    return NextResponse.json({ error: "imageIds required" }, { status: 400 });
  }

  const reason = typeof body?.reason === "string" && body.reason.trim()
    ? body.reason.trim()
    : "관리자 선택 삭제";

  const admin = createAdminClient();
  const imageQuery = applyAdminImageDeleteTargetFilter(admin
    .from("images")
    .select(`
      id, asset_id, title, status, lifecycle_status,
      storage_path_preview, storage_path_full, storage_path_original, original_filename,
      sales_count, proof_status, proof_tx_hash,
      proof_arweave_original_tx_id, proof_arweave_metadata_tx_id, proof_arweave_manifest_tx_id
    `)
    .in("id", uniqueIds));

  const { data, error } = await imageQuery;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = [];
  for (const image of (data ?? []) as ImageDeletionRow[]) {
    const result = await applyImageDeletion(admin, image, {
      actorId: adminUser.id,
      requesterRole: "admin",
      reason,
      feeStatus: "none",
    });
    results.push(result);

    await recordAdminAuditLog(admin, {
      actorId: adminUser.id,
      action: `image.${result.action === "purge" ? "purged" : "archived"}`,
      targetType: "image",
      targetId: image.id,
      targetLabel: image.asset_id ?? image.title,
      before: image as unknown as Record<string, unknown>,
      after: {
        lifecycleStatus: result.lifecycleStatus,
        notice: result.notice,
        errors: result.errors,
      },
      reason,
    });
  }

  return NextResponse.json({ results });
}
