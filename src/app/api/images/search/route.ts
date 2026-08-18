import { NextRequest, NextResponse } from "next/server";
import { getImageIdsForCategory } from "@/lib/images/category-server";
import { chooseKeywordFirstSearchResults, readKeywordFirstSearchThresholds } from "@/lib/images/keyword-first-search";
import { resolveOrientationSearch, type OrientationFilter } from "@/lib/images/orientation-search";
import { getSemanticImageSearchConfig } from "@/lib/images/semantic-embedding";
import { VoyageMultimodalEmbeddingProvider } from "@/lib/images/voyage-multimodal";
import { consumeDistributedRateLimit, requestIdentity } from "@/lib/security/distributed-rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 10;

const MAX_RANKED_CANDIDATES = 100;
const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store" };

interface RankedRow {
  image_id: string;
  keyword_score?: number;
  cosine_similarity?: number;
}

interface ImageRow {
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
  photographer?: { full_name: string | null } | { full_name: string | null }[] | null;
}

function firstPhotographer(photographer: ImageRow["photographer"]) {
  return Array.isArray(photographer) ? photographer[0] : photographer;
}

function boundedInteger(value: string | null, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value ?? String(fallback));
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, minimum), maximum) : fallback;
}

function imageResponse(admin: ReturnType<typeof createAdminClient>, image: ImageRow) {
  const src = image.storage_path_preview
    ? admin.storage.from("images-preview").getPublicUrl(image.storage_path_preview).data.publicUrl
    : "";
  return {
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
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("query")?.trim() ?? "";
  if (!rawQuery || rawQuery.length > 300) {
    return NextResponse.json({ error: "query must be between 1 and 300 characters" }, { status: 400 });
  }

  const rawOrientation = searchParams.get("orientation") ?? "all";
  if (!["all", "landscape", "portrait", "square"].includes(rawOrientation)) {
    return NextResponse.json({ error: "orientation is not supported" }, { status: 400 });
  }
  const resolved = resolveOrientationSearch(rawQuery, rawOrientation as OrientationFilter);
  if (resolved.conflictingOrientations) {
    return NextResponse.json({ images: [], hasMore: false, searchSource: "none" }, { headers: PRIVATE_NO_STORE });
  }
  if (!resolved.textQuery) {
    const browseUrl = new URL(request.url);
    browseUrl.pathname = "/api/images";
    return NextResponse.redirect(browseUrl, 307);
  }

  const limit = boundedInteger(searchParams.get("limit"), 20, 1, 100);
  const offset = boundedInteger(searchParams.get("offset"), 0, 0, 10_000);
  const category = searchParams.get("category") ?? "";
  const freeOnly = searchParams.get("free") === "true";
  const educationFreeOnly = searchParams.get("educationFree") === "true";
  const commercialOnly = searchParams.get("commercial") === "true";
  const derivativesOnly = searchParams.get("derivatives") === "true";
  const thresholds = readKeywordFirstSearchThresholds();
  const admin = createAdminClient();

  const { data: keywordData, error: keywordError } = await admin.rpc("rank_keyword_images", {
    p_search_query: resolved.textQuery,
    p_category_filter: category === "all" ? "" : category,
    p_orientation_filter: resolved.effectiveOrientation,
    p_free_only: freeOnly,
    p_education_free_only: educationFreeOnly,
    p_commercial_only: commercialOnly,
    p_derivatives_only: derivativesOnly,
    p_match_count: MAX_RANKED_CANDIDATES,
    p_offset: 0,
    p_min_score: thresholds.keywordStrong,
  });
  if (keywordError) {
    console.error("[image-search] keyword ranking failed", keywordError.message);
    return NextResponse.json({ error: "Image search is temporarily unavailable" }, { status: 503 });
  }

  const keywordSignals = ((keywordData ?? []) as RankedRow[]).map((row) => ({
    imageId: row.image_id,
    keywordScore: Number(row.keyword_score),
  }));
  let decision = chooseKeywordFirstSearchResults(keywordSignals, undefined, thresholds);

  if (decision.shouldRequestSemanticFallback) {
    let semanticSignals: Array<{ imageId: string; cosineSimilarity: number }> = [];
    try {
      const config = getSemanticImageSearchConfig();
      if (config.queryEnabled && config.provider === "voyage") {
        const rate = await consumeDistributedRateLimit({
          scope: "semantic-text-search",
          identity: requestIdentity(request.headers),
          limit: 2,
          windowSeconds: 60,
        });
        if (rate.allowed) {
          const provider = new VoyageMultimodalEmbeddingProvider({
            apiKey: process.env.VOYAGE_API_KEY ?? "",
            model: config.model!,
            modelVersion: config.modelVersion!,
            dimensions: config.dimensions!,
          });
          const embedding = await provider.embedTextQuery({ purpose: "query", text: resolved.textQuery });
          const { data: semanticData, error: semanticError } = await admin.rpc("match_semantic_image_embeddings", {
            p_query_embedding: embedding,
            p_provider: config.provider,
            p_model: config.model,
            p_model_version: config.modelVersion,
            p_match_count: MAX_RANKED_CANDIDATES,
            p_min_similarity: thresholds.semanticMinimum,
          });
          if (semanticError) throw new Error(semanticError.message);
          semanticSignals = ((semanticData ?? []) as RankedRow[]).map((row) => ({
            imageId: row.image_id,
            cosineSimilarity: Number(row.cosine_similarity),
          }));
        }
      }
    } catch (error) {
      console.error("[image-search] semantic fallback unavailable", error instanceof Error ? error.message : "unknown");
    }
    decision = chooseKeywordFirstSearchResults(keywordSignals, semanticSignals, thresholds);
  }

  let rankedIds = decision.imageIds;
  if (decision.source === "semantic" && category && category !== "all") {
    const allowedCategoryIds = new Set(await getImageIdsForCategory(admin, category) ?? []);
    rankedIds = rankedIds.filter((imageId) => allowedCategoryIds.has(imageId));
  }
  const pageIds = rankedIds.slice(offset, offset + limit);
  if (pageIds.length === 0) {
    return NextResponse.json({ images: [], hasMore: false, searchSource: decision.source }, { headers: PRIVATE_NO_STORE });
  }

  let imageQuery = admin
    .from("images")
    .select("id, asset_id, title, title_ko, title_en, category, storage_path_preview, width, height, photographer_id, copyright_license, free_usage_policy, photographer:profiles!photographer_id(full_name)")
    .in("id", pageIds)
    .eq("status", "approved")
    .eq("lifecycle_status", "active")
    .eq("is_published", true);
  if (resolved.effectiveOrientation !== "all") imageQuery = imageQuery.eq("orientation_class", resolved.effectiveOrientation);
  if (educationFreeOnly) imageQuery = imageQuery.in("free_usage_policy", ["education", "all"]);
  else if (freeOnly) imageQuery = imageQuery.eq("free_usage_policy", "all");
  if (commercialOnly) imageQuery = imageQuery.in("copyright_license", ["standard", "cc0", "cc_by", "cc_by_sa", "cc_by_nd"]);
  if (derivativesOnly) imageQuery = imageQuery.in("copyright_license", ["standard", "cc0", "cc_by", "cc_by_sa", "cc_by_nc", "cc_by_nc_sa"]);

  const { data: imageData, error: imageError } = await imageQuery;
  if (imageError) {
    console.error("[image-search] ranked image lookup failed", imageError.message);
    return NextResponse.json({ error: "Image search is temporarily unavailable" }, { status: 503 });
  }
  const byId = new Map(((imageData ?? []) as unknown as ImageRow[]).map((image) => [image.id, image]));
  const images = pageIds.flatMap((imageId) => {
    const image = byId.get(imageId);
    return image ? [imageResponse(admin, image)] : [];
  });

  return NextResponse.json({
    images,
    hasMore: rankedIds.length > offset + limit,
    searchSource: decision.source,
  }, { headers: PRIVATE_NO_STORE });
}
