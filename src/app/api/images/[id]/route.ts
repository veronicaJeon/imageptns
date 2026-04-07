import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: img, error } = await supabase
    .from("images")
    .select(
      `id, asset_id, title, description, category, tags,
       storage_path_preview, storage_path_full,
       width, height, resolution_mp, file_format, file_size_mb,
       views_count, sales_count, approved_at, created_at,
       photographer:profiles!photographer_id(id, full_name, avatar_url, bio)`
    )
    .eq("id", id)
    .eq("status", "approved")
    .single();

  if (error || !img) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Increment views (fire-and-forget)
  supabase
    .from("images")
    .update({ views_count: (img as any).views_count + 1 })
    .eq("id", id)
    .then(() => {});

  // Similar images (same category, excluding this one)
  const { data: similar } = await supabase
    .from("images")
    .select("id, title, category, storage_path_preview, width, height, photographer:profiles!photographer_id(full_name)")
    .eq("status", "approved")
    .eq("category", (img as any).category)
    .neq("id", id)
    .limit(4);

  // Convert storage paths → public URLs
  function previewUrl(path: string | null | undefined): string {
    if (!path) return "";
    const { data } = supabase.storage.from("images-preview").getPublicUrl(path);
    return data.publicUrl;
  }

  const imgAny = img as any;

  return NextResponse.json({
    image: {
      ...imgAny,
      storage_path_preview: previewUrl(imgAny.storage_path_preview),
    },
    similar: (similar ?? []).map((s: any) => ({
      id: s.id,
      title: s.title,
      category: s.category,
      photographer: s.photographer?.full_name ?? "",
      src: previewUrl(s.storage_path_preview),
      alt: s.title,
      width: s.width ?? 600,
      height: s.height ?? 400,
    })),
  });
}
