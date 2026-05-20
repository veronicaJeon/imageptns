import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface PhotographerProfileRow {
  id: string;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface PhotographerImageRow {
  id: string;
  title: string | null;
  category: string | null;
  storage_path_preview: string | null;
  width: number | null;
  height: number | null;
  sales_count: number | null;
  views_count: number | null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, bio, avatar_url, role, created_at")
    .eq("id", id)
    .eq("role", "photographer")
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: "Photographer not found" }, { status: 404 });
  }

  const { data: images, error: imagesError } = await supabase
    .from("images")
    .select("id, title, category, storage_path_preview, width, height, sales_count, views_count")
    .eq("photographer_id", id)
    .eq("status", "approved")
    .eq("lifecycle_status", "active")
    .order("created_at", { ascending: false })
    .limit(60);

  if (imagesError) {
    return NextResponse.json({ error: imagesError.message }, { status: 500 });
  }

  const { count: totalImages } = await supabase
    .from("images")
    .select("id", { count: "exact", head: true })
    .eq("photographer_id", id)
    .eq("status", "approved")
    .eq("lifecycle_status", "active");

  const profileRow = profile as PhotographerProfileRow;
  const imageList = (images ?? []) as PhotographerImageRow[];

  const totalSales = imageList.reduce((sum, img) => sum + (img.sales_count ?? 0), 0);
  const totalViews = imageList.reduce((sum, img) => sum + (img.views_count ?? 0), 0);

  function previewUrl(path: string | null | undefined): string {
    if (!path) return "";
    const { data } = supabase.storage.from("images-preview").getPublicUrl(path);
    return data.publicUrl;
  }

  return NextResponse.json({
    photographer: {
      id: profileRow.id,
      full_name: profileRow.full_name,
      bio: profileRow.bio,
      avatar_url: profileRow.avatar_url,
      member_since: profileRow.created_at,
      stats: {
        total_images: totalImages ?? 0,
        total_sales: totalSales,
        total_views: totalViews,
      },
    },
    images: imageList.map((img) => ({
      id: img.id,
      title: img.title,
      category: img.category,
      src: previewUrl(img.storage_path_preview),
      alt: img.title,
      width: img.width ?? 600,
      height: img.height ?? 400,
    })),
  });
}
