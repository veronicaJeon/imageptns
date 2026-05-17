import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { previewUrl } from "@/lib/supabase/storage";
import { applyWatermark } from "@/lib/utils/watermark";

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("images")
    .select("id, asset_id, title, description, category, tags, status, rejection_reason, views_count, sales_count, created_at, storage_path_preview, exif_location, exif_taken_at")
    .eq("photographer_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const uploads = (data ?? []).map((img: any) => ({
    ...img,
    storage_path_preview: previewUrl(img.storage_path_preview),
  }));

  return NextResponse.json({ uploads });
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
    exif_taken_at, exif_lat, exif_lng, exif_location, exif_camera,
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
      // For MVP: preview = same file uploaded to images-preview bucket
      storage_path_preview: storage_path_original,
      storage_path_full:    storage_path_original,
      width:                width ?? null,
      height:               height ?? null,
      resolution_mp:        resolution_mp ?? null,
      file_format:          file_format ?? null,
      file_size_mb:         file_size_mb ?? null,
      exif_taken_at:        exif_taken_at ?? null,
      exif_lat:             exif_lat ?? null,
      exif_lng:             exif_lng ?? null,
      exif_location:        exif_location ?? null,
      exif_camera:          exif_camera ?? null,
      status:               "pending",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const originalPath = storage_path_original;
  const previewPath = storage_path_original;
  (async () => {
    const admin = createAdminClient();
    const { data: downloaded, error: downloadErr } = await admin.storage
      .from("images-original")
      .download(originalPath);
    if (downloadErr || !downloaded) throw downloadErr ?? new Error("download returned null");
    const arrayBuffer = await downloaded.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const watermarked = await applyWatermark(buffer);
    const { error: uploadErr } = await admin.storage
      .from("images-preview")
      .upload(previewPath, watermarked, {
        contentType: "image/jpeg",
        upsert: true,
      });
    if (uploadErr) throw uploadErr;
  })().catch(console.error);

  return NextResponse.json({ image: data }, { status: 201 });
}
