import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { downloadImageObject } from "@/lib/storage/image-storage-server";
import type { ImageStorageBucket } from "@/lib/storage/image-path";

export const CLOUDFLARE_IMAGE_INPUT_MAX_BYTES = 20_000_000;

type AdminClient = ReturnType<typeof createAdminClient>;

interface SiteAssetSourceRow {
  storage_path_original: string | null;
  storage_path_full: string | null;
  storage_path_analysis: string | null;
}

async function download(admin: AdminClient, bucket: ImageStorageBucket, path: string) {
  try {
    return await downloadImageObject(admin, bucket, path);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "이미지 원본을 읽지 못했습니다.");
  }
}

export async function downloadSiteAssetSource(
  admin: AdminClient,
  image: SiteAssetSourceRow,
) {
  const originalPath = image.storage_path_original ?? image.storage_path_full;
  if (!originalPath) throw new Error("이미지 원본 경로가 없습니다.");

  const original = await download(admin, "images-original", originalPath);
  if (original.size <= CLOUDFLARE_IMAGE_INPUT_MAX_BYTES) {
    return Buffer.from(await original.arrayBuffer());
  }

  if (!image.storage_path_analysis) {
    throw new Error("고용량 이미지의 전시용 파생본이 없습니다.");
  }
  const analysis = await download(admin, "images-analysis", image.storage_path_analysis);
  if (analysis.size > CLOUDFLARE_IMAGE_INPUT_MAX_BYTES) {
    throw new Error("전시용 파생본의 용량이 너무 큽니다.");
  }
  return Buffer.from(await analysis.arrayBuffer());
}
