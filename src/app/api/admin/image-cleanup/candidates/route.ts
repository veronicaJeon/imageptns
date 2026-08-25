import { NextRequest, NextResponse } from "next/server";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import {
  attachHardDeleteEligibility,
  photographerName,
  storagePathsForHardDelete,
  type HardDeleteImageRow,
} from "@/lib/images/hard-delete-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { previewUrl } from "@/lib/supabase/storage";

const MAX_CANDIDATES = 200;

function safeDate(value: string | null) {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export async function GET(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const createdBefore = safeDate(req.nextUrl.searchParams.get("createdBefore"));
  const status = req.nextUrl.searchParams.get("status") ?? "all";
  const queryText = req.nextUrl.searchParams.get("query")?.trim() ?? "";
  const admin = createAdminClient();

  let query = admin
    .from("images")
    .select(`
      id, asset_id, title, status, lifecycle_status, is_published,
      photographer_id, storage_path_preview, storage_path_analysis, storage_path_full, storage_path_original, original_filename,
      file_size_mb, width, height, sales_count, proof_status, proof_tx_hash,
      proof_arweave_original_tx_id, proof_arweave_metadata_tx_id, proof_arweave_manifest_tx_id,
      proof_arweave_confirmed_at, created_at,
      photographer:profiles!photographer_id(full_name)
    `)
    .lt("created_at", createdBefore)
    .eq("lifecycle_status", "active")
    .order("created_at", { ascending: false })
    .limit(MAX_CANDIDATES);

  if (status !== "all") query = query.eq("status", status);
  if (queryText) {
    const escaped = escapeLike(queryText);
    query = query.or(`title.ilike.%${escaped}%,asset_id.ilike.%${escaped}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const assessed = await Promise.all(
    ((data ?? []) as HardDeleteImageRow[]).map((image) => attachHardDeleteEligibility(admin, image)),
  );
  const candidates = assessed
    .filter((row) => row.eligibility.allowed)
    .map(({ image, referenceCounts, eligibility }) => {
      const storagePaths = storagePathsForHardDelete(image);
      return {
        id: image.id,
        assetId: image.asset_id,
        title: image.title,
        status: image.status,
        lifecycleStatus: image.lifecycle_status,
        isPublished: image.is_published,
        photographerId: image.photographer_id,
        photographerName: photographerName(image),
        previewUrl: previewUrl(image.storage_path_preview),
        fileSizeMb: image.file_size_mb,
        width: image.width,
        height: image.height,
        createdAt: image.created_at,
        storagePaths,
        storageFileCount: storagePaths.originals.length + storagePaths.previews.length,
        referenceCounts,
        eligibility,
      };
    });

  const totalFileSizeMb = candidates.reduce((sum, image) => sum + Number(image.fileSizeMb ?? 0), 0);
  const totalStorageFiles = candidates.reduce((sum, image) => sum + image.storageFileCount, 0);

  return NextResponse.json({
    createdBefore,
    candidates,
    summary: {
      scanned: data?.length ?? 0,
      eligible: candidates.length,
      limit: MAX_CANDIDATES,
      totalFileSizeMb,
      totalStorageFiles,
    },
  });
}
