import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { previewUrl } from "@/lib/supabase/storage";

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("favorites")
    .select(`
      id, image_id, created_at,
      image:images!image_id(id, title, category, status, storage_path_preview, width, height,
        photographer:profiles!photographer_id(full_name))
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const favorites = (data ?? []).map((fav: any) => ({
    ...fav,
    image: fav.image ? { ...fav.image, storage_path_preview: previewUrl(fav.image.storage_path_preview) } : null,
  }));

  return NextResponse.json({ favorites });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { image_id } = await req.json();
  if (!image_id) return NextResponse.json({ error: "image_id required" }, { status: 400 });

  const { data, error } = await supabase
    .from("favorites")
    .insert({ user_id: user.id, image_id })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      // Already favorited — idempotent
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ favorite: data }, { status: 201 });
}
