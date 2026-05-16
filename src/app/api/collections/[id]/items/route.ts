import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { previewUrl } from "@/lib/supabase/storage";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: collection_id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: col, error: colErr } = await supabase
    .from("collections")
    .select("id")
    .eq("id", collection_id)
    .eq("user_id", user.id)
    .single();

  if (colErr || !col) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("collection_items")
    .select(`
      id, image_id, created_at,
      image:images!image_id(id, title, category, status, storage_path_preview, width, height,
        photographer:profiles!photographer_id(full_name))
    `)
    .eq("collection_id", collection_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = (data ?? []).map((item: any) => ({
    ...item,
    image: item.image
      ? { ...item.image, storage_path_preview: previewUrl(item.image.storage_path_preview) }
      : null,
  }));

  return NextResponse.json({ items });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: collection_id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { image_id } = await req.json();
  if (!image_id) return NextResponse.json({ error: "image_id required" }, { status: 400 });

  const { data: col, error: colErr } = await supabase
    .from("collections")
    .select("id")
    .eq("id", collection_id)
    .eq("user_id", user.id)
    .single();

  if (colErr || !col) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("collection_items")
    .insert({ collection_id, image_id })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ ok: true });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data }, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: collection_id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const image_id = req.nextUrl.searchParams.get("image_id");
  if (!image_id) return NextResponse.json({ error: "image_id required" }, { status: 400 });

  const { data: col, error: colErr } = await supabase
    .from("collections")
    .select("id")
    .eq("id", collection_id)
    .eq("user_id", user.id)
    .single();

  if (colErr || !col) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabase
    .from("collection_items")
    .delete()
    .eq("collection_id", collection_id)
    .eq("image_id", image_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
