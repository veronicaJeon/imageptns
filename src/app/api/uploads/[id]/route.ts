import { NextRequest, NextResponse } from "next/server";
import { detachImageFromAboutPage } from "@/lib/about/library-assets";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCopyrightLicenseCode, normalizeFreeUsagePolicy } from "@/lib/licenses/creative-commons";
import { categoryCodesForImage, getImageCategoryCodeMap, normalizeImageCategoryInput, syncImageCategoryAssignments } from "@/lib/images/category-server";
import { requireApprovedPhotographer } from "@/lib/photographers/approval";
import type { AuthorshipDeclaration } from "@/lib/onchain/registration";
import { hasArweaveCredential } from "@/lib/images/deletion";
import { PROMOTIONAL_USE_CONSENT_VERSION } from "@/lib/images/promotional-use";
import { dateValueInTimeZone, takenAtIsAllowed } from "@/lib/uploads/taken-at";

interface ImagePatchRow {
  id: string;
  status: string;
  photographer_id?: string | null;
  promotional_use_allowed: boolean;
}

interface ImageDeleteRow {
  id: string;
  status: string;
  lifecycle_status: string | null;
  proof_arweave_original_tx_id: string | null;
  proof_arweave_metadata_tx_id: string | null;
  proof_arweave_manifest_tx_id: string | null;
  proof_arweave_confirmed_at: string | null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const authorization = await requireApprovedPhotographer(admin, user.id);
  if (!authorization.ok) return authorization.response;

  const { data: img } = await admin
    .from("images")
    .select("id, status, photographer_id, promotional_use_allowed")
    .eq("id", id)
    .eq("photographer_id", user.id)
    .single();

  if (!img) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { title, description, title_ko, title_en, description_ko, description_en, tags_ko, tags_en, category, category_codes, tags, exif_location, exif_taken_at, resubmit, copyright_license, free_usage_policy, attribution_name, attribution_url, authorship_declaration, promotional_use_allowed } = body as {
    title?: string;
    description?: string;
    title_ko?: string;
    title_en?: string;
    description_ko?: string;
    description_en?: string;
    category?: string;
    category_codes?: string[];
    tags?: string[];
    tags_ko?: string[];
    tags_en?: string[];
    exif_location?: string;
    exif_taken_at?: string | null;
    resubmit?: boolean;
    copyright_license?: string;
    free_usage_policy?: string;
    attribution_name?: string | null;
    attribution_url?: string | null;
    authorship_declaration?: AuthorshipDeclaration;
    promotional_use_allowed?: boolean;
  };

  if (title !== undefined && !title.trim()) {
    return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
  }
  if (exif_taken_at && !takenAtIsAllowed(exif_taken_at, dateValueInTimeZone())) {
    return NextResponse.json({ error: "exif_taken_at must be a valid date that is not in the future" }, { status: 400 });
  }

  const image = img as ImagePatchRow;
  const categoryInput = category !== undefined || category_codes !== undefined
    ? await normalizeImageCategoryInput(admin, category_codes, category)
    : null;
  const update: Record<string, unknown> = {};
  if (title !== undefined) update.title = title.trim();
  if (description !== undefined) update.description = description || null;
  if (title_ko !== undefined) update.title_ko = title_ko.trim() || title?.trim() || null;
  if (title_en !== undefined) update.title_en = title_en.trim() || title?.trim() || null;
  if (description_ko !== undefined) update.description_ko = description_ko || description || null;
  if (description_en !== undefined) update.description_en = description_en || description || null;
  if (categoryInput) update.category = categoryInput.primary;
  if (Array.isArray(tags)) update.tags = tags.map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (Array.isArray(tags_ko)) update.tags_ko = tags_ko.map((t) => t.trim()).filter(Boolean);
  if (Array.isArray(tags_en)) update.tags_en = tags_en.map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (exif_location !== undefined) update.exif_location = exif_location || null;
  if (exif_taken_at !== undefined) update.exif_taken_at = exif_taken_at || null;
  if (copyright_license !== undefined) update.copyright_license = normalizeCopyrightLicenseCode(copyright_license);
  if (free_usage_policy !== undefined) update.free_usage_policy = normalizeFreeUsagePolicy(free_usage_policy);
  if (attribution_name !== undefined) update.attribution_name = attribution_name?.trim() || null;
  if (attribution_url !== undefined) update.attribution_url = attribution_url?.trim() || null;
  if (authorship_declaration !== undefined) {
    if (authorship_declaration !== "ai_generated" && authorship_declaration !== "human_original") {
      return NextResponse.json({ error: "Invalid authorship_declaration" }, { status: 400 });
    }
    update.authorship_declaration = authorship_declaration;
    update.authorship_declared_at = new Date().toISOString();
  }
  if (promotional_use_allowed !== undefined && promotional_use_allowed !== image.promotional_use_allowed) {
    if (typeof promotional_use_allowed !== "boolean") {
      return NextResponse.json({ error: "promotional_use_allowed must be boolean" }, { status: 400 });
    }
    update.promotional_use_allowed = promotional_use_allowed;
    if (promotional_use_allowed) {
      update.promotional_use_consented_at = new Date().toISOString();
      update.promotional_use_consent_version = PROMOTIONAL_USE_CONSENT_VERSION;
      update.promotional_use_revoked_at = null;
    } else {
      update.promotional_use_revoked_at = new Date().toISOString();
    }
  }
  // Resubmit: only for rejected/draft → pending (approved stays approved)
  if (resubmit && ["rejected", "draft"].includes(image.status)) {
    update.status = "pending";
    update.rejection_reason = null;
    update.rejected_at = null;
  }

  const { data, error } = await admin
    .from("images")
    .update(update)
    .eq("id", id)
    .eq("photographer_id", user.id)
    .select("id, title, title_ko, title_en, description, description_ko, description_en, category, tags, tags_ko, tags_en, status, rejection_reason, rejected_at, exif_location, exif_taken_at, copyright_license, free_usage_policy, attribution_name, attribution_url, authorship_declaration, authorship_declared_at, promotional_use_allowed, promotional_use_consented_at, promotional_use_consent_version, promotional_use_revoked_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (categoryInput) {
    await syncImageCategoryAssignments(admin, id, categoryInput.codes);
  }
  if (promotional_use_allowed === false && image.promotional_use_allowed) {
    await detachImageFromAboutPage(admin, id);
  }

  const categoryMap = await getImageCategoryCodeMap(admin, [id]);
  return NextResponse.json({
    image: {
      ...data,
      category_codes: categoryCodesForImage(categoryMap, id, data.category),
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const authorization = await requireApprovedPhotographer(admin, user.id);
  if (!authorization.ok) return authorization.response;

  // Legacy DELETE callers use the same archive-only policy as the deletion request endpoint.
  // Physical storage/database deletion remains an administrator operation.
  const { data: img } = await admin
    .from("images")
    .select("id, status, lifecycle_status, proof_arweave_original_tx_id, proof_arweave_metadata_tx_id, proof_arweave_manifest_tx_id, proof_arweave_confirmed_at")
    .eq("id", id)
    .eq("photographer_id", user.id)
    .single();

  if (!img) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const image = img as ImageDeleteRow;
  if (image.lifecycle_status && image.lifecycle_status !== "active") {
    return NextResponse.json({ error: "이미 삭제 절차가 진행 중이거나 완료된 이미지입니다." }, { status: 409 });
  }
  if (hasArweaveCredential(image)) {
    return NextResponse.json({ error: "Arweave 자격증명 이미지는 안내 확인 후 삭제 요청을 접수해야 합니다." }, { status: 409 });
  }

  const { data: result, error } = await admin.rpc("archive_unregistered_photographer_image", {
    target_image_id: id,
    target_user_id: user.id,
    deletion_reason_text: "사진가 직접 삭제",
    reason_category_text: "portfolio_cleanup",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await detachImageFromAboutPage(admin, id);

  return NextResponse.json({ ok: true, immediate: true, result });
}
