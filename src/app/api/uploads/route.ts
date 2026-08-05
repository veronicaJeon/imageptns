import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
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
import {
  automaticPromotionalUseBasis,
  PROMOTIONAL_USE_CONSENT_VERSION,
} from "@/lib/images/promotional-use";
import { dateValueInTimeZone, takenAtIsAllowed } from "@/lib/uploads/taken-at";
import {
  MAX_UPLOAD_FILE_BYTES,
  MAX_UPLOAD_IMAGE_PIXELS,
  uploadPathBelongsToUser,
  validateImageMetadata,
} from "@/lib/uploads/security";
import { readBoundedJson, RequestBodyError } from "@/lib/security/request-body";
import { ownerUploadBucket } from "@/lib/images/state-visibility";
import { storageBinaryBody } from "@/lib/supabase/storage-body";

export const maxDuration = 60;

class UploadValidationError extends Error {}

const SHARP_FORMAT_CONTENT_TYPES: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  tiff: "image/tiff",
};

function validOptionalText(value: unknown, maxLength: number) {
  return value == null || (typeof value === "string" && value.length <= maxLength);
}

function validStringList(value: unknown) {
  return value == null || (
    Array.isArray(value) &&
    value.length <= 50 &&
    value.every((item) => typeof item === "string" && item.length <= 100)
  );
}

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
      .select("id, asset_id, title, title_ko, title_en, description, description_ko, description_en, category, tags, tags_ko, tags_en, status, rejection_reason, rejected_at, lifecycle_status, deletion_requested_at, deletion_fee_krw, deletion_fee_status, deleted_at, archived_at, purged_at, deletion_reason, deletion_admin_note, is_published, unpublished_at, unpublished_reason, views_count, sales_count, created_at, storage_path_preview, exif_location, exif_taken_at, chain_id, onchain_asset_id, content_hash, proof_tx_hash, proof_status, proof_registered_at, proof_arweave_original_tx_id, proof_arweave_metadata_tx_id, proof_arweave_manifest_tx_id, proof_arweave_confirmed_at, proof_failure_reason, copyright_license, free_usage_policy, attribution_name, attribution_url, authorship_declaration, authorship_declared_at, promotional_use_allowed, promotional_use_consented_at, promotional_use_consent_version, promotional_use_revoked_at, promotional_use_basis")
      .eq("photographer_id", user.id)
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
  const visibleData = (data ?? []).filter((image) => ownerUploadBucket(image, {
    rejectedRetentionDays: rejectedImageRetentionDays,
  }) !== null);

  const categoryMap = await getImageCategoryCodeMap(admin, visibleData.map((img) => img.id));
  const uploads = visibleData.map((img) => ({
    ...img,
    category_codes: categoryCodesForImage(categoryMap, img.id, img.category),
    storage_path_preview: previewUrl(img.storage_path_preview),
  }));

  return NextResponse.json({ uploads, rejectedImageRetentionDays }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const authorization = await requireApprovedPhotographer(admin, user.id);
  if (!authorization.ok) return authorization.response;

  let parsedBody: unknown;
  try {
    parsedBody = await readBoundedJson(req, 128 * 1024);
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid upload metadata" },
      { status: error instanceof RequestBodyError ? error.status : 400 },
    );
  }
  if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
    return NextResponse.json({ error: "Invalid upload metadata" }, { status: 400 });
  }
  const body: Awaited<ReturnType<NextRequest["json"]>> = parsedBody;
  const {
    title, description, category, category_codes, tags,
    title_ko, title_en, description_ko, description_en, tags_ko, tags_en,
    upload_session_id, storage_path_original, original_filename,
    upload_rotation_degrees,
    exif_taken_at, exif_lat, exif_lng, exif_location, exif_camera,
    copyright_license, free_usage_policy, attribution_name, attribution_url,
    authorship_declaration, factuality_attested, promotional_use_allowed,
    send_ops_notification,
  } = body;

  const categoryInput = await normalizeImageCategoryInput(admin, category_codes, category);

  if (
    typeof title !== "string" ||
    !title.trim() ||
    title.length > 200 ||
    categoryInput.codes.length === 0 ||
    typeof upload_session_id !== "string" ||
    typeof storage_path_original !== "string"
  ) {
    return NextResponse.json({ error: "title, category, upload_session_id, and storage_path_original required" }, { status: 400 });
  }
  if (
    !validOptionalText(description, 5_000) ||
    !validOptionalText(title_ko, 200) ||
    !validOptionalText(title_en, 200) ||
    !validOptionalText(description_ko, 5_000) ||
    !validOptionalText(description_en, 5_000) ||
    !validOptionalText(attribution_name, 200) ||
    !validOptionalText(attribution_url, 500) ||
    !validOptionalText(exif_location, 500) ||
    !validOptionalText(exif_camera, 500) ||
    !validStringList(tags) ||
    !validStringList(tags_ko) ||
    !validStringList(tags_en)
  ) {
    return NextResponse.json({ error: "Upload metadata contains invalid text or tags" }, { status: 400 });
  }
  if (
    (exif_lat != null && (typeof exif_lat !== "number" || exif_lat < -90 || exif_lat > 90)) ||
    (exif_lng != null && (typeof exif_lng !== "number" || exif_lng < -180 || exif_lng > 180))
  ) {
    return NextResponse.json({ error: "Invalid image coordinates" }, { status: 400 });
  }
  if (!uploadPathBelongsToUser(storage_path_original, user.id)) {
    return NextResponse.json({ error: "Invalid upload path" }, { status: 400 });
  }
  if (authorship_declaration !== "ai_generated" && authorship_declaration !== "human_original") {
    return NextResponse.json({ error: "authorship_declaration must be ai_generated or human_original" }, { status: 400 });
  }
  if (factuality_attested !== true) {
    return NextResponse.json({ error: "factuality_attested must be true" }, { status: 400 });
  }
  if (send_ops_notification !== undefined && typeof send_ops_notification !== "boolean") {
    return NextResponse.json({ error: "send_ops_notification must be boolean" }, { status: 400 });
  }
  if (exif_taken_at && !takenAtIsAllowed(exif_taken_at, dateValueInTimeZone())) {
    return NextResponse.json({ error: "exif_taken_at must be a valid date that is not in the future" }, { status: 400 });
  }

  const uploadRotationDegrees = normalizeRotationDegrees(upload_rotation_degrees);
  const normalizedCopyrightLicense = normalizeCopyrightLicenseCode(copyright_license);
  const normalizedFreeUsagePolicy = normalizeFreeUsagePolicy(free_usage_policy);
  const automaticPromotionBasis = automaticPromotionalUseBasis({
    copyrightLicense: normalizedCopyrightLicense,
    freeUsagePolicy: normalizedFreeUsagePolicy,
  });
  const promotionalUseAllowed = Boolean(automaticPromotionBasis) || promotional_use_allowed === true;
  const promotionalUseBasis = automaticPromotionBasis ?? (promotional_use_allowed === true ? "explicit" : null);

  const { data: uploadSession, error: sessionError } = await admin
    .from("upload_sessions")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", upload_session_id)
    .eq("user_id", user.id)
    .eq("storage_path", storage_path_original)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .select("id, content_type, declared_size_bytes")
    .maybeSingle();

  if (sessionError) {
    console.error("[uploads] Failed to claim upload session", sessionError);
    return NextResponse.json({ error: "Failed to verify upload session" }, { status: 500 });
  }
  if (!uploadSession) {
    return NextResponse.json({ error: "Upload session is invalid, expired, or already used" }, { status: 409 });
  }

  let createdImageId: string | null = null;
  try {
    const { data: downloaded, error: downloadErr } = await admin.storage
      .from("images-original")
      .download(storage_path_original);
    if (downloadErr || !downloaded) throw new UploadValidationError("Uploaded file was not found");
    const arrayBuffer = await downloaded.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length === 0 || buffer.length > MAX_UPLOAD_FILE_BYTES) {
      throw new UploadValidationError("Uploaded file size is invalid");
    }
    if (buffer.length !== Number(uploadSession.declared_size_bytes)) {
      throw new UploadValidationError("Uploaded file size does not match the upload session");
    }

    let metadata;
    try {
      metadata = await sharp(buffer, { limitInputPixels: MAX_UPLOAD_IMAGE_PIXELS }).metadata();
    } catch {
      throw new UploadValidationError("The uploaded file is not a valid supported image");
    }
    const verifiedImage = validateImageMetadata(metadata);
    if (!verifiedImage.ok) throw new UploadValidationError(verifiedImage.error);
    if (SHARP_FORMAT_CONTENT_TYPES[verifiedImage.format] !== uploadSession.content_type) {
      throw new UploadValidationError("Uploaded image type does not match the upload session");
    }

    const watermarked = await applyWatermark(buffer, uploadRotationDegrees);
    const thumbnail = await createWatermarkedThumbnail(buffer, 320, 240, uploadRotationDegrees);
    const watermarkedMetadata = await sharp(watermarked).metadata();
    const displayWidth = watermarkedMetadata.width ?? verifiedImage.width;
    const displayHeight = watermarkedMetadata.height ?? verifiedImage.height;

    const { error: previewError } = await admin.storage
      .from("images-preview")
      .upload(storage_path_original, storageBinaryBody(watermarked), { contentType: "image/jpeg", upsert: true });
    if (previewError) throw previewError;
    const { error: thumbnailError } = await admin.storage
      .from("images-preview")
      .upload(`thumbs/${storage_path_original}`, storageBinaryBody(thumbnail), { contentType: "image/jpeg", upsert: true });
    if (thumbnailError) throw thumbnailError;

    const { data, error } = await supabase
      .from("images")
      .insert({
        photographer_id: user.id,
        title: title.trim(),
        description: description ?? null,
        title_ko: title_ko?.trim() || title.trim(),
        title_en: title_en?.trim() || title.trim(),
        description_ko: description_ko?.trim() || description || null,
        description_en: description_en?.trim() || description || null,
        category: categoryInput.primary,
        tags: tags ?? [],
        tags_ko: Array.isArray(tags_ko) && tags_ko.length > 0 ? tags_ko : tags ?? [],
        tags_en: Array.isArray(tags_en) && tags_en.length > 0 ? tags_en : tags ?? [],
        storage_path_original,
        original_filename: typeof original_filename === "string" ? original_filename.trim().slice(0, 255) : null,
        storage_path_preview: storage_path_original,
        storage_path_full: storage_path_original,
        width: displayWidth,
        height: displayHeight,
        resolution_mp: Number(((displayWidth * displayHeight) / 1_000_000).toFixed(1)),
        file_format: verifiedImage.format === "jpeg" ? "JPG" : verifiedImage.format.toUpperCase(),
        file_size_mb: Number((buffer.length / 1024 / 1024).toFixed(2)),
        upload_rotation_degrees: uploadRotationDegrees,
        upload_original_width: verifiedImage.width,
        upload_original_height: verifiedImage.height,
        exif_taken_at: exif_taken_at ?? null,
        exif_lat: exif_lat ?? null,
        exif_lng: exif_lng ?? null,
        exif_location: exif_location ?? null,
        exif_camera: exif_camera ?? null,
        copyright_license: normalizedCopyrightLicense,
        free_usage_policy: normalizedFreeUsagePolicy,
        attribution_name: attribution_name?.trim() || null,
        attribution_url: attribution_url?.trim() || null,
        authorship_declaration: authorship_declaration as AuthorshipDeclaration,
        authorship_declared_at: new Date().toISOString(),
        factuality_attested: true,
        factuality_attested_at: new Date().toISOString(),
        factuality_attestation_version: "2026-05-20",
        promotional_use_allowed: promotionalUseAllowed,
        promotional_use_consented_at: promotionalUseAllowed ? new Date().toISOString() : null,
        promotional_use_consent_version: promotionalUseAllowed ? PROMOTIONAL_USE_CONSENT_VERSION : null,
        promotional_use_revoked_at: null,
        promotional_use_basis: promotionalUseBasis,
        lifecycle_status: "active",
        is_published: false,
        status: "pending",
      })
      .select()
      .single();

    if (error || !data) throw error ?? new Error("Failed to save uploaded image");
    createdImageId = data.id;
    await syncImageCategoryAssignments(admin, data.id, categoryInput.codes);

    const { error: consumedError } = await admin
      .from("upload_sessions")
      .update({
        status: "consumed",
        consumed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", uploadSession.id)
      .eq("status", "processing");
    if (consumedError) {
      console.error("[uploads] Failed to mark upload session consumed", consumedError);
    }

    if (send_ops_notification !== false) {
      notifyOpsNewUpload({
        photographerEmail: user.email ?? "",
        photographerName: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Unknown",
        imageTitle: title.trim(),
        imageId: data.id,
      }).catch((e) => console.error("[uploads] admin notify failed", e));
    }

    return NextResponse.json({ image: data }, { status: 201 });
  } catch (err) {
    console.error("[uploads] Upload processing failed:", err);
    if (createdImageId) {
      await admin.from("images").delete().eq("id", createdImageId);
    }
    await Promise.all([
      admin.storage.from("images-original").remove([storage_path_original]),
      admin.storage.from("images-preview").remove([
        storage_path_original,
        `thumbs/${storage_path_original}`,
      ]),
      admin
        .from("upload_sessions")
        .update({
          status: "failed",
          failure_code: err instanceof UploadValidationError ? "validation_failed" : "processing_failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", uploadSession.id),
    ]);

    const message = err instanceof UploadValidationError ? err.message : "Failed to process uploaded image";
    return NextResponse.json(
      { error: message },
      { status: err instanceof UploadValidationError ? 400 : 500 },
    );
  }
}
