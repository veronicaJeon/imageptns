import { NextRequest, NextResponse } from "next/server";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { imageStorageProvider } from "@/lib/storage/image-path";
import { downloadImageObject } from "@/lib/storage/image-storage-server";

const MAX_DOWNLOADS = 50;

interface DownloadImageRow {
  id: string;
  asset_id: string | null;
  title: string;
  original_filename: string | null;
  file_format: string | null;
  storage_path_original: string | null;
  storage_path_full: string | null;
}

function sanitizeFilename(value: string) {
  return value
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function filenameFor(image: DownloadImageRow) {
  if (image.original_filename) return sanitizeFilename(image.original_filename);
  const extension = image.file_format?.replace(/^\./, "").toLowerCase() || "jpg";
  const base = sanitizeFilename(`${image.asset_id ?? image.id}-${image.title}`);
  return `${base}.${extension}`;
}

export async function POST(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const body = await req.json().catch(() => null) as { imageIds?: unknown } | null;
  const imageIds = Array.isArray(body?.imageIds)
    ? body.imageIds.filter((id): id is string => typeof id === "string")
    : [];

  const uniqueIds = Array.from(new Set(imageIds)).slice(0, MAX_DOWNLOADS);
  if (uniqueIds.length === 0) {
    return NextResponse.json({ error: "imageIds required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("images")
    .select("id, asset_id, title, original_filename, file_format, storage_path_original, storage_path_full")
    .in("id", uniqueIds);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as DownloadImageRow[];
  const files = await Promise.all(rows.map(async (image) => {
    const path = image.storage_path_original ?? image.storage_path_full;
    if (!path) return { id: image.id, error: "원본 파일 경로가 없습니다." };

    const fileName = filenameFor(image);
    if (imageStorageProvider(path) === "r2") {
      return {
        id: image.id,
        assetId: image.asset_id,
        title: image.title,
        fileName,
        url: `/api/admin/images/download?imageId=${encodeURIComponent(image.id)}&file=1`,
        expiresInSeconds: 60 * 60,
      };
    }
    const { data: signed, error: signedError } = await admin.storage
      .from("images-original")
      .createSignedUrl(path, 60 * 60, { download: fileName });

    if (signedError || !signed?.signedUrl) {
      return { id: image.id, error: signedError?.message ?? "다운로드 URL 생성 실패" };
    }

    return {
      id: image.id,
      assetId: image.asset_id,
      title: image.title,
      fileName,
      url: signed.signedUrl,
      expiresInSeconds: 60 * 60,
    };
  }));

  return NextResponse.json({ files });
}

export async function GET(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();
  if (req.nextUrl.searchParams.get("file") !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const imageId = req.nextUrl.searchParams.get("imageId");
  if (!imageId) return NextResponse.json({ error: "imageId required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: image, error } = await admin
    .from("images")
    .select("id, asset_id, title, original_filename, file_format, storage_path_original, storage_path_full")
    .eq("id", imageId)
    .maybeSingle();
  if (error || !image) return NextResponse.json({ error: "Image not found" }, { status: 404 });

  const row = image as DownloadImageRow;
  const path = row.storage_path_original ?? row.storage_path_full;
  if (!path || imageStorageProvider(path) !== "r2") {
    return NextResponse.json({ error: "R2 image not found" }, { status: 404 });
  }

  try {
    const file = await downloadImageObject(admin, "images-original", path);
    const filename = filenameFor(row);
    return new NextResponse(file.stream(), {
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "Content-Length": String(file.size),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not read downloadable file" }, { status: 503 });
  }
}
