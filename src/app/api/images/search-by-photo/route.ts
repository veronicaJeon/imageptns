import { NextRequest, NextResponse } from "next/server";
import { previewUrl } from "@/lib/supabase/storage";
import { createImageFingerprint, type ImageFingerprint } from "@/lib/images/fingerprint";
import { readKeywordFirstSearchThresholds } from "@/lib/images/keyword-first-search";
import { getSemanticImageSearchConfig } from "@/lib/images/semantic-embedding";
import { buyerCanViewImage } from "@/lib/images/state-visibility";
import { VoyageMultimodalEmbeddingProvider } from "@/lib/images/voyage-multimodal";
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
import { ALLOWED_UPLOAD_IMAGE_TYPES } from "@/lib/uploads/security";
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

interface WorkerSelfReference {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

function validFingerprint(value: unknown): value is ImageFingerprint {
  if (!value || typeof value !== "object") return false;
  const fingerprint = value as Partial<ImageFingerprint>;
  return typeof fingerprint.originalSha256 === "string"
    && /^[a-f0-9]{64}$/.test(fingerprint.originalSha256)
    && typeof fingerprint.phash === "string"
    && /^[01]{64}$/.test(fingerprint.phash)
    && typeof fingerprint.dhash === "string"
    && /^[01]{64}$/.test(fingerprint.dhash)
    && Number.isInteger(fingerprint.width)
    && Number(fingerprint.width) > 0
    && Number.isInteger(fingerprint.height)
    && Number(fingerprint.height) > 0
    && fingerprint.algorithmVersion === "phash-dhash-jsquash-v2";
}

async function cloudflareImageService() {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const context = await getCloudflareContext<Record<string, unknown>, unknown>({ async: true });
    return (context.env as { WORKER_SELF_REFERENCE?: WorkerSelfReference }).WORKER_SELF_REFERENCE ?? null;
  } catch {
    return null;
  }
}

async function cloudflareFingerprint(input: Buffer, contentType: string) {
  const service = await cloudflareImageService();
  if (!service) return null;

  const response = await service.fetch("https://imagepartners.internal/__internal/image-fingerprint", {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: Uint8Array.from(input).buffer,
  });
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) {
    const error = new Error(payload?.error || "The search image could not be analyzed") as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  if (!validFingerprint(payload)) throw new Error("Invalid image fingerprint response");
  return payload;
}

async function normalizedSemanticQuery(input: Buffer) {
  const service = await cloudflareImageService();
  if (service) {
    const response = await service.fetch("https://imagepartners.internal/__internal/image-normalize", {
      method: "POST",
      body: Uint8Array.from(input).buffer,
    });
    if (!response.ok) throw new Error(`Image normalization failed with HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }

  const { default: sharp } = await import("sharp");
  return sharp(input)
    .rotate()
    .resize({ width: 1_024, height: 1_024, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
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
  let queryFingerprint: ImageFingerprint;
  try {
    const workerFingerprint = await cloudflareFingerprint(input, file.type);
    if (workerFingerprint) {
      queryFingerprint = workerFingerprint;
    } else {
      const { default: sharp } = await import("sharp");
      const metadata = await sharp(input).metadata();
      const width = metadata.autoOrient.width;
      const height = metadata.autoOrient.height;
      if (!width || !height || width * height > PHOTO_SEARCH_MAX_IMAGE_PIXELS) {
        return errorResponse("Search image dimensions are too large", 413);
      }
      queryFingerprint = await createImageFingerprint(input);
    }
  } catch (error) {
    const status = Number((error as { status?: number }).status);
    if (status === 413 || status === 415) {
      return errorResponse(error instanceof Error ? error.message : "Unsupported image format", status);
    }
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

  if (matches.length === 0) {
    try {
      const config = getSemanticImageSearchConfig();
      if (config.queryEnabled && config.provider === "voyage") {
        const semanticRate = await consumeDistributedRateLimit({
          scope: "semantic-photo-search",
          identity: requestIdentity(req.headers),
          limit: 2,
          windowSeconds: 60,
        });
        if (semanticRate.allowed) {
          const normalizedQuery = await normalizedSemanticQuery(input);
          const provider = new VoyageMultimodalEmbeddingProvider({
            apiKey: process.env.VOYAGE_API_KEY ?? "",
            model: config.model!,
            modelVersion: config.modelVersion!,
            dimensions: config.dimensions!,
          });
          const embedding = await provider.embedImageQuery({
            purpose: "query",
            bytes: normalizedQuery,
            mimeType: "image/jpeg",
          });
          const { semanticMinimum } = readKeywordFirstSearchThresholds();
          const { data: semanticData, error: semanticError } = await admin.rpc("match_semantic_image_embeddings", {
            p_query_embedding: embedding,
            p_provider: config.provider,
            p_model: config.model,
            p_model_version: config.modelVersion,
            p_match_count: 20,
            p_min_similarity: semanticMinimum,
          });
          if (semanticError) throw new Error(semanticError.message);
          const semanticIds = ((semanticData ?? []) as Array<{ image_id: string }>).map((row) => row.image_id);
          if (semanticIds.length > 0) {
            const { data: semanticImages, error: semanticImagesError } = await admin
              .from("images")
              .select("id, asset_id, title, title_ko, title_en, category, storage_path_preview, width, height, photographer_id, copyright_license, free_usage_policy, status, lifecycle_status, is_published, photographer:profiles!photographer_id(full_name)")
              .in("id", semanticIds)
              .eq("status", "approved")
              .eq("lifecycle_status", "active")
              .eq("is_published", true);
            if (semanticImagesError) throw new Error(semanticImagesError.message);
            const semanticById = new Map(((semanticImages ?? []) as unknown as NonNullable<FingerprintSearchRow["image"]>[])
              .map((image) => [image.id, image]));
            const images = semanticIds.flatMap((imageId) => {
              const image = semanticById.get(imageId);
              if (!image || !buyerCanViewImage(image) || !image.storage_path_preview) return [];
              const src = previewUrl(image.storage_path_preview);
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
                photoMatchKind: "semantic",
              }];
            });
            return NextResponse.json({ images }, { headers: PRIVATE_NO_STORE });
          }
        }
      }
    } catch (error) {
      console.error("[photo-search] semantic fallback unavailable", error instanceof Error ? error.message : "unknown");
    }
  }

  const images = matches.flatMap((match) => {
    const row = rowByImageId.get(match.imageId);
    const image = row?.image;
    if (!image) return [];
    let src = "";
    if (image.storage_path_preview) {
      src = previewUrl(image.storage_path_preview);
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
