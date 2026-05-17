import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query    = searchParams.get("query") ?? "";
  const category = searchParams.get("category") ?? "";
  const sort     = searchParams.get("sort") ?? "newest";
  const limit    = Math.min(Number(searchParams.get("limit") ?? String(PAGE_SIZE)), 100);
  const offset   = Number(searchParams.get("offset") ?? "0");
  const fetchCount = limit + 1; // fetch one extra to determine hasMore

  const supabase = await createClient();

  let q = supabase
    .from("images")
    .select(
      "id, asset_id, title, category, tags, storage_path_preview, width, height, photographer:profiles!photographer_id(full_name)"
    )
    .eq("status", "approved")
    .range(offset, offset + fetchCount - 1);

  if (category && category !== "all") {
    q = q.eq("category", category);
  }

  if (query) {
    q = q.textSearch("fts", query, { type: "plain" });
  }

  if (sort === "relevant" && query) {
    const { data: rpcData, error: rpcError } = await supabase.rpc("search_images", {
      search_query:    query,
      category_filter: category === "all" ? "" : category,
      lim:             limit,
      off:             offset,
    });

    if (rpcError) {
      console.error("search_images RPC error, falling back to newest:", rpcError.message);
    } else {
      const rawRpc = rpcData ?? [];
      const hasMoreRpc = rawRpc.length > limit;
      const slicedRpc = hasMoreRpc ? rawRpc.slice(0, limit) : rawRpc;
      const images = slicedRpc.map((img: any) => {
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
          category:     img.category,
          photographer: img.photographer_name ?? "",
          src,
          alt:          img.title,
          width:        img.width ?? 800,
          height:       img.height ?? 600,
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

  const images = sliced.map((img: any) => {
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
      category:     img.category,
      photographer: img.photographer?.full_name ?? "",
      src,
      alt:          img.title,
      width:        img.width ?? 800,
      height:       img.height ?? 600,
    };
  });

  return NextResponse.json({ images, hasMore });
}
