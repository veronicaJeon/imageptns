import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface ImageDetailRow {
  id: string;
  asset_id: string | null;
  title: string;
  description: string | null;
  category: string;
  tags: string[] | null;
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
  category: string;
  storage_path_preview: string | null;
  width: number | null;
  height: number | null;
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

  const { data: img, error } = await supabase
    .from("images")
    .select(
      `id, asset_id, title, description, category, tags,
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
    .single();

  if (error || !img) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const image = img as ImageDetailRow;

  // Increment views via admin client — RLS blocks updates on approved images for non-owners
  const admin = createAdminClient();
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

  // Similar images (same category, excluding this one)
  const { data: similar } = await supabase
    .from("images")
    .select("id, title, category, storage_path_preview, width, height, photographer:profiles!photographer_id(full_name)")
    .eq("status", "approved")
    .eq("category", image.category)
    .neq("id", id)
    .limit(4);

  // Convert storage paths → public URLs
  function previewUrl(path: string | null | undefined): string {
    if (!path) return "";
    const { data } = supabase.storage.from("images-preview").getPublicUrl(path);
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
      storage_path_preview: previewUrl(image.storage_path_preview),
      photographer: photographer
        ? { ...photographer, display_name: photographerName }
        : null,
    },
    similar: ((similar ?? []) as SimilarImageRow[]).map((s) => ({
      id: s.id,
      title: s.title,
      category: s.category,
      photographer: firstPhotographer(s.photographer)?.full_name ?? "",
      src: previewUrl(s.storage_path_preview),
      alt: s.title,
      width: s.width ?? 600,
      height: s.height ?? 400,
    })),
  });
}
