import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { previewUrl } from "@/lib/supabase/storage";
import { applyWatermark, createWatermarkedThumbnail } from "@/lib/utils/watermark";
import { notifyOpsNewUpload } from "@/lib/email/resend";
import { normalizeCopyrightLicenseCode, normalizeFreeUsagePolicy } from "@/lib/licenses/creative-commons";
import { normalizeRotationDegrees } from "@/lib/images/orientation";
import { categoryCodesForImage, getImageCategoryCodeMap, normalizeImageCategoryInput, syncImageCategoryAssignments } from "@/lib/images/category-server";
import { requireApprovedPhotographer } from "@/lib/photographers/approval";
import type { AuthorshipDeclaration } from "@/lib/onchain/registration";

export const maxDuration = 60;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const authorization = await requireApprovedPhotographer(admin, user.id);
  if (!authorization.ok) return authorization.response;

  const [imagesResult, settingsResult] = await Promise.all([
    admin
      .from("images")
      .select("id, asset_id, title, title_ko, title_en, description, description_ko, description_en, category, tags, tags_ko, tags_en, status, rejection_reason, rejected_at, lifecycle_status, deletion_requested_at, deletion_fee_krw, deletion_fee_status, views_count, sales_count, created_at, storage_path_preview, exif_location, exif_taken_at, chain_id, onchain_asset_id, content_hash, proof_tx_hash, proof_status, proof_registered_at, proof_arweave_original_tx_id, proof_arweave_metadata_tx_id, proof_arweave_manifest_tx_id, proof_arweave_confirmed_at, proof_failure_reason, copyright_license, free_usage_policy, attribution_name, attribution_url, authorship_declaration, authorship_declared_at")
      .eq("photographer_id", user.id)
      .eq("lifecycle_status", "active")
      .order("created_at", { ascending: false }),
    admin
      .from("platform_commerce_settings")
      .select("rejected_image_retention_days")
      .eq("id", true)
      .maybeSingle(),
  ]);
  const { data, error } = imagesResult;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rejectedImageRetentionDays = Math.min(365, Math.max(1, Number(settingsResult.data?.rejected_image_retention_days ?? 7)));
  const rejectedCutoff = Date.now() - rejectedImageRetentionDays * 24 * 60 * 60 * 1000;
  const visibleData = (data ?? []).filter((image) => (
    image.status !== "rejected" ||
    new Date(image.rejected_at ?? image.created_at).getTime() >= rejectedCutoff
  ));

  const categoryMap = await getImageCategoryCodeMap(admin, visibleData.map((img) => img.id));
  const uploads = visibleData.map((img) => ({
    ...img,
    category_codes: categoryCodesForImage(categoryMap, img.id, img.category),
    storage_path_preview: previewUrl(img.storage_path_preview),
  }));

  return NextResponse.json({ uploads, rejectedImageRetentionDays });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const authorization = await requireApprovedPhotographer(admin, user.id);
  if (!authorization.ok) return authorization.response;

  const body = await req.json();
  const {
    title, description, category, category_codes, tags,
    title_ko, title_en, description_ko, description_en, tags_ko, tags_en,
    storage_path_original, original_filename,
    width, height, resolution_mp, file_format, file_size_mb,
    upload_rotation_degrees, upload_original_width, upload_original_height,
    exif_taken_at, exif_lat, exif_lng, exif_location, exif_camera,
    copyright_license, free_usage_policy, attribution_name, attribution_url,
    authorship_declaration, factuality_attested,
  } = body;

  const categoryInput = await normalizeImageCategoryInput(admin, category_codes, category);

  if (!title || categoryInput.codes.length === 0 || !storage_path_original) {
    return NextResponse.json({ error: "title, category, and storage_path_original required" }, { status: 400 });
  }
  if (authorship_declaration !== "ai_generated" && authorship_declaration !== "human_original") {
    return NextResponse.json({ error: "authorship_declaration must be ai_generated or human_original" }, { status: 400 });
  }
  if (factuality_attested !== true) {
    return NextResponse.json({ error: "factuality_attested must be true" }, { status: 400 });
  }

  const uploadRotationDegrees = normalizeRotationDegrees(upload_rotation_degrees);

  const { data, error } = await supabase
    .from("images")
    .insert({
      photographer_id:      user.id,
      title,
      description:          description ?? null,
      title_ko:             title_ko?.trim() || title,
      title_en:             title_en?.trim() || title,
      description_ko:       description_ko?.trim() || description || null,
      description_en:       description_en?.trim() || description || null,
      category:             categoryInput.primary,
      tags:                 tags ?? [],
      tags_ko:              Array.isArray(tags_ko) && tags_ko.length > 0 ? tags_ko : tags ?? [],
      tags_en:              Array.isArray(tags_en) && tags_en.length > 0 ? tags_en : tags ?? [],
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
      upload_rotation_degrees: uploadRotationDegrees,
      upload_original_width: upload_original_width ?? width ?? null,
      upload_original_height: upload_original_height ?? height ?? null,
      exif_taken_at:        exif_taken_at ?? null,
      exif_lat:             exif_lat ?? null,
      exif_lng:             exif_lng ?? null,
      exif_location:        exif_location ?? null,
      exif_camera:          exif_camera ?? null,
      copyright_license:    normalizeCopyrightLicenseCode(copyright_license),
      free_usage_policy:    normalizeFreeUsagePolicy(free_usage_policy),
      attribution_name:     attribution_name?.trim() || null,
      attribution_url:      attribution_url?.trim() || null,
      authorship_declaration: authorship_declaration as AuthorshipDeclaration,
      authorship_declared_at: new Date().toISOString(),
      factuality_attested: true,
      factuality_attested_at: new Date().toISOString(),
      factuality_attestation_version: "2026-05-20",
      status:               "pending",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await syncImageCategoryAssignments(admin, data.id, categoryInput.codes);

  // Apply watermark synchronously before returning so Vercel doesn't terminate it early
  try {
    const { data: downloaded, error: downloadErr } = await admin.storage
      .from("images-original")
      .download(storage_path_original);
    if (downloadErr || !downloaded) throw downloadErr ?? new Error("download returned null");
    const arrayBuffer = await downloaded.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const watermarked = await applyWatermark(buffer, uploadRotationDegrees);
    const thumbnail = await createWatermarkedThumbnail(buffer, 320, 240, uploadRotationDegrees);
    await admin.storage
      .from("images-preview")
      .upload(storage_path_original, watermarked, { contentType: "image/jpeg", upsert: true });
    await admin.storage
      .from("images-preview")
      .upload(`thumbs/${storage_path_original}`, thumbnail, { contentType: "image/jpeg", upsert: true });
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
