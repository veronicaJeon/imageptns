import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { previewUrl } from "@/lib/supabase/storage";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
  return profile?.is_admin ? user : null;
}

interface InsightImageRow {
  id: string;
  title: string | null;
  category: string | null;
  views_count?: number | null;
  sales_count?: number | null;
  storage_path_preview: string | null;
  photographer: { full_name: string | null } | { full_name: string | null }[] | null;
}

interface FavoriteCountRow {
  image_id: string;
}

function photographerName(row: InsightImageRow) {
  const photographer = Array.isArray(row.photographer) ? row.photographer[0] : row.photographer;
  return photographer?.full_name ?? "Unknown";
}

export async function GET(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const sort = (searchParams.get("sort") ?? "views") as "views" | "sales" | "favorites";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);

  const admin = createAdminClient();

  // Top images by views or sales (directly in images table)
  if (sort === "views" || sort === "sales") {
    const col = sort === "views" ? "views_count" : "sales_count";
    const { data, error } = await admin
      .from("images")
      .select(`id, title, category, ${col}, storage_path_preview, photographer:profiles!photographer_id(full_name)`)
      .eq("status", "approved")
      .order(col, { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      sort,
      images: ((data ?? []) as InsightImageRow[]).map((img) => ({
        id: img.id,
        title: img.title,
        category: img.category,
        photographer: photographerName(img),
        src: previewUrl(img.storage_path_preview),
        value: sort === "views" ? img.views_count ?? 0 : img.sales_count ?? 0,
      })),
    });
  }

  // Top images by favorites count — aggregate from favorites table
  const { data: favCounts, error: favErr } = await admin
    .from("favorites")
    .select("image_id")
    .order("image_id");

  if (favErr) return NextResponse.json({ error: favErr.message }, { status: 500 });

  // Count favorites per image
  const countMap: Record<string, number> = {};
  for (const row of ((favCounts ?? []) as FavoriteCountRow[])) {
    countMap[row.image_id] = (countMap[row.image_id] ?? 0) + 1;
  }

  // Sort by count and take top N
  const topIds = Object.entries(countMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  if (topIds.length === 0) return NextResponse.json({ sort, images: [] });

  const { data: imgs, error: imgErr } = await admin
    .from("images")
    .select("id, title, category, storage_path_preview, photographer:profiles!photographer_id(full_name)")
    .in("id", topIds);

  if (imgErr) return NextResponse.json({ error: imgErr.message }, { status: 500 });

  const sorted = topIds
    .map((id) => {
      const img = ((imgs ?? []) as InsightImageRow[]).find((i) => i.id === id);
      if (!img) return null;
      return {
        id: img.id,
        title: img.title,
        category: img.category,
        photographer: photographerName(img),
        src: previewUrl(img.storage_path_preview),
        value: countMap[id] ?? 0,
      };
    })
    .filter(Boolean);

  return NextResponse.json({ sort, images: sorted });
}
