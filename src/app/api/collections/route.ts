import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { previewUrl } from "@/lib/supabase/storage";

interface CollectionThumbnailImage {
  storage_path_preview: string | null;
}

interface CollectionItemSummary {
  image: CollectionThumbnailImage | CollectionThumbnailImage[] | null;
}

interface CollectionRow {
  id: string;
  name: string;
  created_at: string;
  collection_items: CollectionItemSummary[] | null;
}

function firstJoinedImage(image: CollectionItemSummary["image"]) {
  return Array.isArray(image) ? image[0] : image;
}

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("collections")
    .select(`
      id, name, created_at,
      collection_items(
        id, image_id,
        image:images!image_id(id, storage_path_preview)
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const collections = ((data ?? []) as CollectionRow[]).map((col) => {
    const items = col.collection_items ?? [];
    const firstImage = firstJoinedImage(items[0]?.image ?? null);
    return {
      id: col.id,
      name: col.name,
      created_at: col.created_at,
      item_count: items.length,
      thumbnail: firstImage ? previewUrl(firstImage.storage_path_preview) : null,
    };
  });

  return NextResponse.json({ collections });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const { data, error } = await supabase
    .from("collections")
    .insert({ user_id: user.id, name: name.trim() })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ collection: { ...data, item_count: 0, thumbnail: null } }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase
    .from("collections")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
