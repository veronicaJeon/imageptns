import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCopyrightLicenseCode, normalizeFreeUsagePolicy } from "@/lib/licenses/creative-commons";
import { isImageCategoryCode } from "@/lib/images/categories";
import { requireApprovedPhotographer } from "@/lib/photographers/approval";
import type { AuthorshipDeclaration } from "@/lib/onchain/registration";

interface ImagePatchRow {
  id: string;
  status: string;
  photographer_id?: string | null;
}

interface ImageDeleteRow {
  id: string;
  status: string;
  storage_path_original: string | null;
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

  const { data: img } = await supabase
    .from("images")
    .select("id, status, photographer_id")
    .eq("id", id)
    .eq("photographer_id", user.id)
    .single();

  if (!img) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { title, description, title_ko, title_en, description_ko, description_en, tags_ko, tags_en, category, tags, exif_location, exif_taken_at, resubmit, copyright_license, free_usage_policy, attribution_name, attribution_url, authorship_declaration } = body as {
    title?: string;
    description?: string;
    title_ko?: string;
    title_en?: string;
    description_ko?: string;
    description_en?: string;
    category?: string;
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
  };

  if (title !== undefined && !title.trim()) {
    return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
  }
  if (category !== undefined && !isImageCategoryCode(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const image = img as ImagePatchRow;
  const update: Record<string, unknown> = {};
  if (title !== undefined) update.title = title.trim();
  if (description !== undefined) update.description = description || null;
  if (title_ko !== undefined) update.title_ko = title_ko.trim() || title?.trim() || null;
  if (title_en !== undefined) update.title_en = title_en.trim() || title?.trim() || null;
  if (description_ko !== undefined) update.description_ko = description_ko || description || null;
  if (description_en !== undefined) update.description_en = description_en || description || null;
  if (category !== undefined) update.category = category;
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
  // Resubmit: only for rejected/draft → pending (approved stays approved)
  if (resubmit && ["rejected", "draft"].includes(image.status)) {
    update.status = "pending";
    update.rejection_reason = null;
  }

  const { data, error } = await admin
    .from("images")
    .update(update)
    .eq("id", id)
    .eq("photographer_id", user.id)
    .select("id, title, title_ko, title_en, description, description_ko, description_en, category, tags, tags_ko, tags_en, status, rejection_reason, exif_location, exif_taken_at, copyright_license, free_usage_policy, attribution_name, attribution_url, authorship_declaration, authorship_declared_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ image: data });
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

  // Only allow deleting own pending/rejected images
  const { data: img } = await supabase
    .from("images")
    .select("id, status, storage_path_original")
    .eq("id", id)
    .eq("photographer_id", user.id)
    .single();

  if (!img) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const image = img as ImageDeleteRow;
  if (!["pending", "rejected", "draft"].includes(image.status)) {
    return NextResponse.json({ error: "Cannot delete approved images" }, { status: 403 });
  }

  // Remove from both original and preview storage if path exists.
  if (image.storage_path_original) {
    await admin.storage.from("images-original").remove([image.storage_path_original]);
    await admin.storage.from("images-preview").remove([image.storage_path_original]);
  }

  const { error } = await admin.from("images").delete().eq("id", id).eq("photographer_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
