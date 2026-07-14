import { NextRequest, NextResponse } from "next/server";
import { categoryCodesForImage, getImageCategoryCodeMap, getImageIdsForCategory } from "@/lib/images/category-server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rankSimilarImages, similaritySearchTerms } from "@/lib/images/similarity";

interface ImageDetailRow {
  id: string;
  asset_id: string | null;
  title: string;
  title_ko: string | null;
  title_en: string | null;
  description: string | null;
  description_ko: string | null;
  description_en: string | null;
  category: string;
  tags: string[] | null;
  tags_ko: string[] | null;
  tags_en: string[] | null;
  storage_path_preview: string | null;
  storage_path_full: string | null;
  width: number | null;
  height: number | null;
  resolution_mp: number | null;
  file_format: string | null;
  file_size_mb: number | null;
  exif_taken_at: string | null;
  exif_location: string | null;
  views_count: number;
  sales_count: number;
  approved_at: string | null;
  created_at: string;
  copyright_license: string | null;
  free_usage_policy: string | null;
  attribution_name: string | null;
  attribution_url: string | null;
  photographer_id: string | null;
  photographer:
    | { id: string; full_name: string | null; avatar_url: string | null; bio: string | null }
    | { id: string; full_name: string | null; avatar_url: string | null; bio: string | null }[]
    | null;
}

interface SimilarImageRow {
  id: string;
  title: string;
  title_ko?: string | null;
  title_en?: string | null;
  description?: string | null;
  description_ko?: string | null;
  description_en?: string | null;
  category: string;
  tags?: string[] | null;
  tags_ko?: string[] | null;
  tags_en?: string[] | null;
  exif_location?: string | null;
  storage_path_preview: string | null;
  width: number | null;
  height: number | null;
  photographer_id: string | null;
  photographer: { full_name: string | null } | { full_name: string | null }[] | null;
}

function firstPhotographer(photographer: SimilarImageRow["photographer"]) {
  return Array.isArray(photographer) ? photographer[0] : photographer;
}

function imagePhotographer(photographer: ImageDetailRow["photographer"]) {
  return Array.isArray(photographer) ? photographer[0] : photographer;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();

  const { data: img, error } = await admin
    .from("images")
    .select(
      `id, asset_id, title, title_ko, title_en, description, description_ko, description_en, category, tags, tags_ko, tags_en,
       storage_path_preview, storage_path_full,
       width, height, resolution_mp, file_format, file_size_mb,
       exif_taken_at, exif_location,
       views_count, sales_count, approved_at, created_at,
       copyright_license, free_usage_policy, attribution_name, attribution_url,
       photographer_id,
       photographer:profiles!photographer_id(id, full_name, avatar_url, bio)`
    )
    .eq("id", id)
    .eq("status", "approved")
    .eq("lifecycle_status", "active")
    .eq("is_published", true)
    .single();

  if (error || !img) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const image = img as ImageDetailRow;
  const currentCategoryMap = await getImageCategoryCodeMap(admin, [id]);
  const currentCategoryCodes = categoryCodesForImage(currentCategoryMap, id, image.category);

  // Increment views via admin client — RLS blocks updates on approved images for non-owners
  admin
    .from("images")
    .update({ views_count: image.views_count + 1 })
    .eq("id", id)
    .then(() => {});

  admin
    .from("user_events")
    .insert({
      user_id: user?.id ?? null,
      event_type: "image_view",
      path: req.nextUrl.pathname,
      image_id: id,
      referrer: req.headers.get("referer"),
      user_agent: req.headers.get("user-agent"),
      metadata: {},
    })
    .then(() => {});

  const similarCategoryIdSets = await Promise.all(currentCategoryCodes.map((code) => getImageIdsForCategory(admin, code)));
  const similarIds = Array.from(new Set(similarCategoryIdSets.flatMap((ids) => ids ?? []))).filter((imageId) => imageId !== id);

  const similarSelect = `id, title, title_ko, title_en, description, description_ko, description_en, category,
    tags, tags_ko, tags_en, exif_location, storage_path_preview, width, height, photographer_id,
    photographer:profiles!photographer_id(full_name)`;
  const currentSimilarityMetadata = {
    id: image.id,
    title: image.title,
    title_ko: image.title_ko,
    title_en: image.title_en,
    description: image.description,
    description_ko: image.description_ko,
    description_en: image.description_en,
    tags: image.tags,
    tags_ko: image.tags_ko,
    tags_en: image.tags_en,
    exif_location: image.exif_location,
    photographer_id: image.photographer_id,
    categoryCodes: currentCategoryCodes,
  };

  // Build a broad candidate pool, then rank it by title, tags, and shooting
  // location. Category is only a tie-breaker and cannot make an unrelated
  // image appear as "similar" by itself.
  let categoryQuery = admin
    .from("images")
    .select(similarSelect)
    .eq("status", "approved")
    .eq("lifecycle_status", "active")
    .eq("is_published", true)
    .neq("id", id)
    .order("created_at", { ascending: false })
    .limit(160);

  categoryQuery = similarIds.length > 0
    ? categoryQuery.in("id", similarIds.slice(0, 500))
    : categoryQuery.eq("category", image.category);

  const searchTerms = similaritySearchTerms(currentSimilarityMetadata);
  const titleQuery = searchTerms.length > 0
    ? admin
      .from("images")
      .select(similarSelect)
      .eq("status", "approved")
      .eq("lifecycle_status", "active")
      .eq("is_published", true)
      .neq("id", id)
      .or(searchTerms.flatMap((term) => [
        `title.ilike.%${term}%`,
        `title_ko.ilike.%${term}%`,
        `title_en.ilike.%${term}%`,
      ]).join(","))
      .limit(80)
    : null;

  const [{ data: categoryCandidates }, titleResult] = await Promise.all([
    categoryQuery,
    titleQuery ?? Promise.resolve({ data: [] }),
  ]);
  const candidateMap = new Map<string, SimilarImageRow>();
  for (const row of [...(categoryCandidates ?? []), ...(titleResult.data ?? [])] as SimilarImageRow[]) {
    candidateMap.set(row.id, row);
  }
  const candidates = Array.from(candidateMap.values());
  const similarCategoryMap = await getImageCategoryCodeMap(admin, candidates.map((row) => row.id));
  const similar = rankSimilarImages(
    currentSimilarityMetadata,
    candidates.map((candidate) => ({
      ...candidate,
      categoryCodes: categoryCodesForImage(similarCategoryMap, candidate.id, candidate.category),
    })),
  ).slice(0, 4).map(({ image: candidate }) => candidate);

  // Convert storage paths → public URLs
  function previewUrl(path: string | null | undefined): string {
    if (!path) return "";
    const { data } = admin.storage.from("images-preview").getPublicUrl(path);
    return data.publicUrl;
  }

  // Photographer display name: full_name → email prefix fallback
  const photographer = imagePhotographer(image.photographer);
  let photographerName: string = photographer?.full_name?.trim() ?? "";
  if (!photographerName && image.photographer_id) {
    const { data: authUser } = await admin.auth.admin.getUserById(image.photographer_id);
    photographerName = authUser?.user?.email?.split("@")[0] ?? "Unknown";
  }

  return NextResponse.json({
    image: {
      ...image,
      category_codes: currentCategoryCodes,
      storage_path_preview: previewUrl(image.storage_path_preview),
      photographer: photographer
        ? { ...photographer, display_name: photographerName }
        : null,
    },
    similar: similar.map((s) => ({
      id: s.id,
      title: s.title,
      titleKo: s.title_ko,
      titleEn: s.title_en,
      category: s.category,
      categoryCodes: categoryCodesForImage(similarCategoryMap, s.id, s.category),
      photographerId: s.photographer_id,
      photographer: firstPhotographer(s.photographer)?.full_name ?? "",
      src: previewUrl(s.storage_path_preview),
      alt: s.title,
      width: s.width ?? 600,
      height: s.height ?? 400,
    })),
  });
}
