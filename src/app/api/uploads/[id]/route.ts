import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCopyrightLicenseCode, normalizeFreeUsagePolicy } from "@/lib/licenses/creative-commons";
import type { AuthorshipDeclaration } from "@/lib/onchain/registration";

const VALID_CATEGORIES = ["nature", "people", "editorial", "urban", "abstract", "architecture"] as const;
type ValidCategory = typeof VALID_CATEGORIES[number];

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

  const { data: img } = await supabase
    .from("images")
    .select("id, status, photographer_id")
    .eq("id", id)
    .eq("photographer_id", user.id)
    .single();

  if (!img) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { title, description, category, tags, exif_location, exif_taken_at, resubmit, copyright_license, free_usage_policy, attribution_name, attribution_url, authorship_declaration } = body as {
    title?: string;
    description?: string;
    category?: string;
    tags?: string[];
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
  if (category !== undefined && !VALID_CATEGORIES.includes(category as ValidCategory)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const image = img as ImagePatchRow;
  const update: Record<string, unknown> = {};
  if (title !== undefined) update.title = title.trim();
  if (description !== undefined) update.description = description || null;
  if (category !== undefined) update.category = category;
  if (Array.isArray(tags)) update.tags = tags.map((t) => t.trim().toLowerCase()).filter(Boolean);
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

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("images")
    .update(update)
    .eq("id", id)
    .eq("photographer_id", user.id)
    .select("id, title, description, category, tags, status, rejection_reason, exif_location, exif_taken_at, copyright_license, free_usage_policy, attribution_name, attribution_url, authorship_declaration, authorship_declared_at")
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
    const admin = createAdminClient();
    await admin.storage.from("images-original").remove([image.storage_path_original]);
    await admin.storage.from("images-preview").remove([image.storage_path_original]);
  }

  const { error } = await createAdminClient().from("images").delete().eq("id", id).eq("photographer_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
