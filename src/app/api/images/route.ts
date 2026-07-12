import { NextRequest, NextResponse } from "next/server";
import { categoryCodesForImage, getImageCategoryCodeMap, getImageIdsForCategory } from "@/lib/images/category-server";
import { createAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 20;

interface ImageListRow {
  id: string;
  asset_id: string | null;
  title: string;
  title_ko: string | null;
  title_en: string | null;
  category: string;
  tags: string[] | null;
  storage_path_preview: string | null;
  width: number | null;
  height: number | null;
  photographer_id: string | null;
  photographer?: { full_name: string | null } | { full_name: string | null }[] | null;
  copyright_license: string | null;
  free_usage_policy: string | null;
}

interface SearchImageRpcRow {
  id: string;
  asset_id: string | null;
  title: string;
  title_ko?: string | null;
  title_en?: string | null;
  category: string;
  storage_path_preview: string | null;
  width: number | null;
  height: number | null;
  photographer_id?: string | null;
  photographer_name: string | null;
  copyright_license: string | null;
  free_usage_policy: string | null;
}

function firstPhotographer(photographer: ImageListRow["photographer"]) {
  return Array.isArray(photographer) ? photographer[0] : photographer;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query    = searchParams.get("query") ?? "";
  const category = searchParams.get("category") ?? "";
  const sort     = searchParams.get("sort") ?? "newest";
  const rawLimit = Number(searchParams.get("limit") ?? String(PAGE_SIZE));
  const rawOffset = Number(searchParams.get("offset") ?? "0");
  const limit = Number.isInteger(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : PAGE_SIZE;
  const offset = Number.isInteger(rawOffset) ? Math.max(rawOffset, 0) : 0;
  const fetchCount = limit + 1; // fetch one extra to determine hasMore
  const freeOnly = searchParams.get("free") === "true";
  const educationFreeOnly = searchParams.get("educationFree") === "true";
  const commercialOnly = searchParams.get("commercial") === "true";
  const derivativesOnly = searchParams.get("derivatives") === "true";
  const hasUsageFilters = freeOnly || educationFreeOnly || commercialOnly || derivativesOnly;

  const supabase = createAdminClient();
  let categoryImageIds: string[] | null = null;
  if (category && category !== "all") {
    categoryImageIds = await getImageIdsForCategory(supabase, category);
    if (categoryImageIds && categoryImageIds.length === 0) {
      return NextResponse.json({ images: [], hasMore: false });
    }
  }

  let q = supabase
    .from("images")
    .select(
      "id, asset_id, title, title_ko, title_en, category, tags, storage_path_preview, width, height, photographer_id, copyright_license, free_usage_policy, photographer:profiles!photographer_id(full_name)"
    )
    .eq("status", "approved")
    .eq("lifecycle_status", "active")
    .eq("is_published", true)
    .range(offset, offset + fetchCount - 1);

  if (category && category !== "all") {
    q = categoryImageIds
      ? q.in("id", categoryImageIds)
      : q.eq("category", category);
  }

  if (query) {
    q = q.textSearch("fts", query, { type: "plain" });
  }

  if (educationFreeOnly) {
    q = q.in("free_usage_policy", ["education", "all"]);
  } else if (freeOnly) {
    q = q.eq("free_usage_policy", "all");
  }

  if (commercialOnly) {
    q = q.in("copyright_license", ["standard", "cc0", "cc_by", "cc_by_sa", "cc_by_nd"]);
  }

  if (derivativesOnly) {
    q = q.in("copyright_license", ["standard", "cc0", "cc_by", "cc_by_sa", "cc_by_nc", "cc_by_nc_sa"]);
  }

  // The search_images RPC does not accept publishing controls yet, so relevant
  // searches fall through to the table query to avoid exposing hidden images.
  const useRpcSearch = false && sort === "relevant" && query && !hasUsageFilters;

  if (useRpcSearch) {
    const { data: rpcData, error: rpcError } = await supabase.rpc("search_images", {
      search_query:    query,
      category_filter: category === "all" ? "" : category,
      lim:             limit,
      off:             offset,
      license_filters: null,
      free_only:       false,
    });

    if (rpcError) {
      console.error("search_images RPC error, falling back to newest:", rpcError.message);
    } else {
      const rawRpc = rpcData ?? [];
      const hasMoreRpc = rawRpc.length > limit;
      const slicedRpc = hasMoreRpc ? rawRpc.slice(0, limit) : rawRpc;
      const images = (slicedRpc as SearchImageRpcRow[]).map((img) => {
        let src = "";
        if (img.storage_path_preview) {
          const { data: urlData } = supabase.storage
            .from("images-preview")
            .getPublicUrl(img.storage_path_preview);
          src = urlData.publicUrl;
        }
        return {
          id:           img.id,
          assetId:      img.asset_id,
          title:        img.title,
          titleKo:      img.title_ko,
          titleEn:      img.title_en,
          category:     img.category,
          photographerId: img.photographer_id ?? null,
          photographer: img.photographer_name ?? "",
          src,
          alt:          img.title,
          width:        img.width ?? 800,
          height:       img.height ?? 600,
          copyrightLicense: img.copyright_license,
          freeUsagePolicy:  img.free_usage_policy,
        };
      });
      return NextResponse.json({ images, hasMore: hasMoreRpc });
    }
  }

  if (sort === "newest") {
    q = q.order("created_at", { ascending: false });
  } else if (sort === "popular") {
    q = q.order("sales_count", { ascending: false });
  } else {
    q = q.order("created_at", { ascending: false });
  }

  const { data, error } = await q;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const raw = data ?? [];
  const hasMore = raw.length > limit;
  const sliced = hasMore ? raw.slice(0, limit) : raw;
  const categoryMap = await getImageCategoryCodeMap(supabase, sliced.map((img) => img.id));

  const images = (sliced as ImageListRow[]).map((img) => {
    let src = "";
    if (img.storage_path_preview) {
      const { data: urlData } = supabase.storage
        .from("images-preview")
        .getPublicUrl(img.storage_path_preview);
      src = urlData.publicUrl;
    }
    return {
      id:           img.id,
      assetId:      img.asset_id,
      title:        img.title,
      titleKo:      img.title_ko,
      titleEn:      img.title_en,
      category:     img.category,
      categoryCodes: categoryCodesForImage(categoryMap, img.id, img.category),
      photographerId: img.photographer_id,
      photographer: firstPhotographer(img.photographer)?.full_name ?? "",
      src,
      alt:          img.title,
      width:        img.width ?? 800,
      height:       img.height ?? 600,
      copyrightLicense: img.copyright_license,
      freeUsagePolicy:  img.free_usage_policy,
    };
  });

  return NextResponse.json({ images, hasMore });
}
