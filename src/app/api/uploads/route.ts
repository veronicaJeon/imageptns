import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("images")
    .select("id, asset_id, title, category, status, rejection_reason, views_count, sales_count, created_at, storage_path_preview")
    .eq("photographer_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ uploads: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    title, description, category, tags,
    storage_path_original,
    width, height, resolution_mp, file_format, file_size_mb,
  } = body;

  if (!title || !category || !storage_path_original) {
    return NextResponse.json({ error: "title, category, and storage_path_original required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("images")
    .insert({
      photographer_id:      user.id,
      title,
      description:          description ?? null,
      category,
      tags:                 tags ?? [],
      storage_path_original,
      storage_path_preview: null,
      storage_path_full:    null,
      width:                width ?? null,
      height:               height ?? null,
      resolution_mp:        resolution_mp ?? null,
      file_format:          file_format ?? null,
      file_size_mb:         file_size_mb ?? null,
      status:               "pending",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ image: data }, { status: 201 });
}
