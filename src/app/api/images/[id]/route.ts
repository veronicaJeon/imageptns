import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
       exif_taken_at, exif_location,
       views_count, sales_count, approved_at, created_at,
       photographer_id,
       photographer:profiles!photographer_id(id, full_name, avatar_url, bio)`
    )
    .eq("id", id)
    .eq("status", "approved")
    .single();

  if (error || !img) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Increment views via admin client — RLS blocks updates on approved images for non-owners
  createAdminClient()
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

  // Photographer display name: full_name → email prefix fallback
  let photographerName: string = imgAny.photographer?.full_name?.trim() ?? "";
  if (!photographerName && imgAny.photographer_id) {
    const admin = createAdminClient();
    const { data: authUser } = await admin.auth.admin.getUserById(imgAny.photographer_id);
    photographerName = authUser?.user?.email?.split("@")[0] ?? "Unknown";
  }

  return NextResponse.json({
    image: {
      ...imgAny,
      storage_path_preview: previewUrl(imgAny.storage_path_preview),
      photographer: imgAny.photographer
        ? { ...imgAny.photographer, display_name: photographerName }
        : null,
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
