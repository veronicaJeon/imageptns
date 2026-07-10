import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createStoredZip, sanitizeZipFilename, uniqueZipFilename, type ZipFileEntry } from "@/lib/download/zip";

export const maxDuration = 60;

const MAX_BULK_DOWNLOADS = 20;

type DownloadRecord = {
  id: string;
  expires_at: string;
  download_count: number;
  order_item_id: string;
};

type BulkImage = {
  storage_path_full: string | null;
  storage_path_original: string | null;
  original_filename: string | null;
  asset_id: string | null;
};

type BulkOrderItem = {
  id: string;
  image_original_path_snapshot: string | null;
  image_original_filename_snapshot: string | null;
  image_lifecycle_status: string | null;
  image_deletion_notice: string | null;
  image: BulkImage | BulkImage[] | null;
};

function normalizeIds(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function fileExtension(path: string | null | undefined) {
  const match = path?.match(/\.([a-zA-Z0-9]{2,5})(?:$|\?)/);
  return match ? `.${match[1].toLowerCase()}` : ".jpg";
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as { orderItemIds?: unknown } | null;
  const orderItemIds = Array.from(new Set(normalizeIds(body?.orderItemIds))).slice(0, MAX_BULK_DOWNLOADS);

  if (orderItemIds.length === 0) {
    return NextResponse.json({ error: "No downloadable items selected" }, { status: 400 });
  }

  const { data: downloads, error: dlError } = await supabase
    .from("downloads")
    .select("id, expires_at, download_count, order_item_id")
    .eq("user_id", user.id)
    .in("order_item_id", orderItemIds);

  if (dlError) return NextResponse.json({ error: dlError.message }, { status: 500 });

  const downloadByItemId = new Map((downloads ?? []).map((row) => [row.order_item_id, row as DownloadRecord]));
  const authorizedIds = orderItemIds.filter((id) => {
    const download = downloadByItemId.get(id);
    return download && new Date(download.expires_at) >= new Date();
  });

  if (authorizedIds.length === 0) {
    return NextResponse.json({ error: "No active download links found" }, { status: 404 });
  }

  const { data: items, error: itemError } = await supabase
    .from("order_items")
    .select("id, image_original_path_snapshot, image_original_filename_snapshot, image_lifecycle_status, image_deletion_notice, image:images!image_id(storage_path_full, storage_path_original, original_filename, asset_id)")
    .in("id", authorizedIds);

  if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 });

  const itemById = new Map((items ?? []).map((row) => [row.id, row as BulkOrderItem]));
  const admin = createAdminClient();
  const usedNames = new Set<string>();
  const files: ZipFileEntry[] = [];
  const updatedDownloadIds: string[] = [];

  for (const id of authorizedIds) {
    const item = itemById.get(id);
    const download = downloadByItemId.get(id);
    if (!item || !download) continue;

    const imageData = Array.isArray(item.image) ? item.image[0] : item.image;
    const image = imageData as BulkImage | null;
    const storagePath = image?.storage_path_full ?? image?.storage_path_original ?? item.image_original_path_snapshot;
    if (!storagePath) continue;

    const { data, error } = await admin.storage.from("images-original").download(storagePath);
    if (error || !data) continue;

    const arrayBuffer = await data.arrayBuffer();
    const fallbackName = `${image?.asset_id ?? id}${fileExtension(storagePath)}`;
    const rawName = image?.original_filename ?? item.image_original_filename_snapshot ?? fallbackName;
    const safeName = uniqueZipFilename(sanitizeZipFilename(rawName, fallbackName), usedNames);

    files.push({ name: safeName, data: Buffer.from(arrayBuffer) });
    updatedDownloadIds.push(download.id);
  }

  if (files.length === 0) {
    return NextResponse.json({ error: "Could not prepare downloadable files" }, { status: 404 });
  }

  const zip = createStoredZip(files);

  await Promise.all(
    updatedDownloadIds.map((downloadId) => {
      const download = (downloads ?? []).find((row) => row.id === downloadId) as DownloadRecord | undefined;
      if (!download) return Promise.resolve();
      return admin
        .from("downloads")
        .update({ download_count: download.download_count + 1 })
        .eq("id", downloadId);
    }),
  );

  const filename = `imagepartners-downloads-${new Date().toISOString().slice(0, 10)}.zip`;

  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
