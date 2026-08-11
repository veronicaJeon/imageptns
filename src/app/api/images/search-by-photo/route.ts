import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createImageFingerprint } from "@/lib/images/fingerprint";
import { buyerCanViewImage } from "@/lib/images/state-visibility";
import {
  PHOTO_SEARCH_MAX_CANDIDATES,
  PHOTO_SEARCH_MAX_FILE_BYTES,
  PHOTO_SEARCH_MAX_IMAGE_PIXELS,
  rankVisualMatches,
  type VisualSearchCandidate,
} from "@/lib/images/visual-search";
import {
  consumeDistributedRateLimit,
  requestIdentity,
} from "@/lib/security/distributed-rate-limit";
import { ALLOWED_SHARP_FORMATS, ALLOWED_UPLOAD_IMAGE_TYPES } from "@/lib/uploads/security";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 30;

const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store" };
const MULTIPART_OVERHEAD_BYTES = 256 * 1024;

interface FingerprintSearchRow {
  original_sha256: string;
  phash: string;
  dhash: string;
  width: number;
  height: number;
  algorithm_version: string;
  image: {
    id: string;
    asset_id: string | null;
    title: string;
    title_ko: string | null;
    title_en: string | null;
    category: string;
    storage_path_preview: string | null;
    width: number | null;
    height: number | null;
    photographer_id: string | null;
    copyright_license: string | null;
    free_usage_policy: string | null;
    status: string;
    lifecycle_status: string | null;
    is_published: boolean;
    photographer?: { full_name: string | null } | { full_name: string | null }[] | null;
  } | null;
}

function errorResponse(error: string, status: number, retryAfter?: number) {
  return NextResponse.json({ error }, {
    status,
    headers: {
      ...PRIVATE_NO_STORE,
      ...(retryAfter == null ? {} : { "Retry-After": String(retryAfter) }),
    },
  });
}

function firstPhotographer(
  photographer: { full_name: string | null } | { full_name: string | null }[] | null | undefined,
) {
  return Array.isArray(photographer) ? photographer[0] : photographer;
}

export async function POST(req: NextRequest) {
  const declaredLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > PHOTO_SEARCH_MAX_FILE_BYTES + MULTIPART_OVERHEAD_BYTES) {
    return errorResponse("Search image is too large", 413);
  }

  const rate = await consumeDistributedRateLimit({
    scope: "photo-search",
    identity: requestIdentity(req.headers),
    limit: 20,
    windowSeconds: 60,
  });
  if (!rate.allowed) {
    return errorResponse(
      rate.unavailable ? "Photo search is temporarily unavailable" : "Too many photo searches",
      rate.unavailable ? 503 : 429,
      rate.retryAfterSeconds,
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return errorResponse("Invalid photo search request", 400);
  }

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return errorResponse("Search image is required", 400);
  }
  if (file.size > PHOTO_SEARCH_MAX_FILE_BYTES) {
    return errorResponse("Search image is too large", 413);
  }
  if (!Object.hasOwn(ALLOWED_UPLOAD_IMAGE_TYPES, file.type.toLowerCase())) {
    return errorResponse("Unsupported image format", 415);
  }

  const input = Buffer.from(await file.arrayBuffer());
  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    metadata = await sharp(input).metadata();
  } catch {
    return errorResponse("Invalid image file", 400);
  }

  const width = metadata.autoOrient.width;
  const height = metadata.autoOrient.height;
  if (!metadata.format || !ALLOWED_SHARP_FORMATS.has(metadata.format.toLowerCase())) {
    return errorResponse("Unsupported image format", 415);
  }
  if (!width || !height || width * height > PHOTO_SEARCH_MAX_IMAGE_PIXELS) {
    return errorResponse("Search image dimensions are too large", 413);
  }

  let queryFingerprint;
  try {
    queryFingerprint = await createImageFingerprint(input);
  } catch {
    return errorResponse("The search image could not be analyzed", 400);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("image_fingerprints")
    .select(`
      original_sha256, phash, dhash, width, height, algorithm_version,
      image:images!image_fingerprints_image_id_fkey!inner(
        id, asset_id, title, title_ko, title_en, category, storage_path_preview,
        width, height, photographer_id, copyright_license, free_usage_policy,
        status, lifecycle_status, is_published,
        photographer:profiles!photographer_id(full_name)
      )
    `)
    .eq("algorithm_version", queryFingerprint.algorithmVersion)
    .eq("image.status", "approved")
    .eq("image.lifecycle_status", "active")
    .eq("image.is_published", true)
    .limit(PHOTO_SEARCH_MAX_CANDIDATES);

  if (error) {
    console.error("[photo-search] public fingerprint lookup failed", { code: error.code, message: error.message });
    return errorResponse("Photo search is temporarily unavailable", 503);
  }

  const rows = (data ?? []) as unknown as FingerprintSearchRow[];
  const publicRows = rows.filter((row) => (
    row.image &&
    buyerCanViewImage(row.image) &&
    Boolean(row.image.storage_path_preview)
  ));
  const candidates: VisualSearchCandidate[] = publicRows.map((row) => ({
    imageId: row.image!.id,
    originalSha256: row.original_sha256,
    phash: row.phash,
    dhash: row.dhash,
    width: row.width,
    height: row.height,
    algorithmVersion: row.algorithm_version,
  }));
  const matches = rankVisualMatches(queryFingerprint, candidates);
  const rowByImageId = new Map(publicRows.map((row) => [row.image!.id, row]));

  const images = matches.flatMap((match) => {
    const row = rowByImageId.get(match.imageId);
    const image = row?.image;
    if (!image) return [];
    let src = "";
    if (image.storage_path_preview) {
      src = admin.storage.from("images-preview").getPublicUrl(image.storage_path_preview).data.publicUrl;
    }
    return [{
      id: image.id,
      assetId: image.asset_id,
      title: image.title,
      titleKo: image.title_ko,
      titleEn: image.title_en,
      category: image.category,
      photographerId: image.photographer_id,
      photographer: firstPhotographer(image.photographer)?.full_name ?? "",
      src,
      alt: image.title,
      width: image.width ?? 800,
      height: image.height ?? 600,
      copyrightLicense: image.copyright_license,
      freeUsagePolicy: image.free_usage_policy,
      photoMatchKind: match.matchKind,
    }];
  });

  return NextResponse.json({ images }, { headers: PRIVATE_NO_STORE });
}
