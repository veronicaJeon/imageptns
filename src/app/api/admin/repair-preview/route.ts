import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyWatermark, createWatermarkedThumbnail } from "@/lib/utils/watermark";
import { storageBinaryBody } from "@/lib/supabase/storage-body";
import { authorizeCronRequest } from "@/lib/security/cron";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { recordOperationalEvent } from "@/lib/monitoring/events";

export const maxDuration = 60;

interface RepairPreviewImageRow {
  id: string;
  storage_path_original: string | null;
  storage_path_preview: string | null;
}

export async function POST(req: NextRequest) {
  const legacySecret = process.env.ADMIN_SECRET;
  const hasLegacySecret = Boolean(legacySecret)
    && req.headers.get("x-admin-secret") === legacySecret;
  const maintenanceAuthorization = authorizeCronRequest(req.headers);
  const adminUser = await requireAdminUser();
  if (!adminUser && !hasLegacySecret && !maintenanceAuthorization.authorized) {
    return forbidden();
  }

  const { image_id } = await req.json().catch(() => ({ image_id: null }));
  if (typeof image_id !== "string" || !/^[0-9a-f-]{36}$/i.test(image_id)) {
    return NextResponse.json({ error: "Valid image_id required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: img, error: fetchErr } = await admin
    .from("images")
    .select("id, storage_path_original, storage_path_preview")
    .eq("id", image_id)
    .single();

  if (fetchErr || !img) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  const image = img as RepairPreviewImageRow;
  const originalPath = image.storage_path_original;
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
  const thumbnail = await createWatermarkedThumbnail(buffer);

  const { error: uploadErr } = await admin.storage
    .from("images-preview")
    .upload(originalPath, storageBinaryBody(watermarked), { contentType: "image/jpeg", upsert: true });

  if (uploadErr) {
    return NextResponse.json({ error: `Preview upload failed: ${uploadErr.message}` }, { status: 500 });
  }

  const { error: thumbUploadErr } = await admin.storage
    .from("images-preview")
    .upload(`thumbs/${originalPath}`, storageBinaryBody(thumbnail), { contentType: "image/jpeg", upsert: true });

  if (thumbUploadErr) {
    return NextResponse.json({ error: `Thumbnail upload failed: ${thumbUploadErr.message}` }, { status: 500 });
  }

  await recordOperationalEvent({
    eventType: "image_preview_repaired",
    component: "storage",
    status: "ok",
    route: "/api/admin/repair-preview",
    statusCode: 200,
    metadata: {
      imageId: image_id,
      actor: adminUser ? "admin" : "maintenance",
    },
  });

  return NextResponse.json({ ok: true, repaired: image_id });
}
