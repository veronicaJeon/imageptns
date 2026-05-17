import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyWatermark } from "@/lib/utils/watermark";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-admin-secret");
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { image_id } = await req.json();
  if (!image_id) return NextResponse.json({ error: "image_id required" }, { status: 400 });

  const admin = createAdminClient();

  const { data: img, error: fetchErr } = await admin
    .from("images")
    .select("id, storage_path_original, storage_path_preview")
    .eq("id", image_id)
    .single();

  if (fetchErr || !img) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  const originalPath = (img as any).storage_path_original as string;
  if (!originalPath) {
    return NextResponse.json({ error: "No original path on record" }, { status: 400 });
  }

  const { data: downloaded, error: downloadErr } = await admin.storage
    .from("images-original")
    .download(originalPath);

  if (downloadErr || !downloaded) {
    return NextResponse.json({ error: `Download failed: ${downloadErr?.message}` }, { status: 500 });
  }

  const buffer = Buffer.from(await downloaded.arrayBuffer());
  const watermarked = await applyWatermark(buffer);

  const { error: uploadErr } = await admin.storage
    .from("images-preview")
    .upload(originalPath, watermarked, { contentType: "image/jpeg", upsert: true });

  if (uploadErr) {
    return NextResponse.json({ error: `Preview upload failed: ${uploadErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, repaired: image_id });
}
