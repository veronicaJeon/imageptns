import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { previewUrl } from "@/lib/supabase/storage";
import { applyWatermark } from "@/lib/utils/watermark";
import { notifyOpsNewUpload } from "@/lib/email/resend";

export const maxDuration = 60;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("images")
    .select("id, asset_id, title, description, category, tags, status, rejection_reason, views_count, sales_count, created_at, storage_path_preview, exif_location, exif_taken_at, chain_id, onchain_asset_id, content_hash, proof_tx_hash, proof_status, proof_registered_at")
    .eq("photographer_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const uploads = (data ?? []).map((img) => ({
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
    storage_path_original, original_filename,
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
      original_filename:    original_filename ?? null,
      // preview path same as original path, different bucket — filled by watermark step below
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

  // Apply watermark synchronously before returning so Vercel doesn't terminate it early
  try {
    const admin = createAdminClient();
    const { data: downloaded, error: downloadErr } = await admin.storage
      .from("images-original")
      .download(storage_path_original);
    if (downloadErr || !downloaded) throw downloadErr ?? new Error("download returned null");
    const arrayBuffer = await downloaded.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const watermarked = await applyWatermark(buffer);
    await admin.storage
      .from("images-preview")
      .upload(storage_path_original, watermarked, { contentType: "image/jpeg", upsert: true });
  } catch (err) {
    console.error("[uploads] Watermark/preview generation failed:", err);
    // Image record is already saved — preview will be missing but upload succeeded
  }

  // Notify admin of new upload (fire-and-forget, non-blocking)
  notifyOpsNewUpload({
    photographerEmail: user.email ?? "",
    photographerName:  user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Unknown",
    imageTitle:        title,
    imageId:           data.id,
  }).catch((e) => console.error("[uploads] admin notify failed", e));

  return NextResponse.json({ image: data }, { status: 201 });
}
