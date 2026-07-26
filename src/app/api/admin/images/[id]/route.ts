import { NextRequest, NextResponse } from "next/server";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { detachImageFromAboutPage } from "@/lib/about/library-assets";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeLicensePrice } from "@/lib/commerce/pricing";
import { previewUrl } from "@/lib/supabase/storage";
import { categoryCodesForImage, getImageCategoryCodeMap, normalizeImageCategoryInput, syncImageCategoryAssignments } from "@/lib/images/category-server";

function normalizeTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((tag) => String(tag).trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 50);
}

function stringValue(value: unknown, max = 5000) {
  if (value == null) return "";
  return String(value).trim().slice(0, max);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const { id } = await params;
  const admin = createAdminClient();

  const [{ data: image, error: imageError }, { data: overrides, error: overridesError }] = await Promise.all([
    admin
      .from("images")
      .select("id, asset_id, title, title_ko, title_en, description, description_ko, description_en, category, tags, tags_ko, tags_en, status, is_published, storage_path_preview")
      .eq("id", id)
      .single(),
    admin
      .from("image_price_overrides")
      .select("license_code, price_krw")
      .eq("image_id", id),
  ]);

  if (imageError || !image) return NextResponse.json({ error: imageError?.message ?? "Image not found" }, { status: 404 });
  if (overridesError) return NextResponse.json({ error: overridesError.message }, { status: 500 });

  const categoryMap = await getImageCategoryCodeMap(admin, [id]);

  return NextResponse.json({
    image: {
      ...image,
      category_codes: categoryCodesForImage(categoryMap, id, image.category),
      storage_path_preview: previewUrl(image.storage_path_preview),
      price_overrides: overrides ?? [],
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const admin = createAdminClient();

  const title = stringValue(body.title, 200);
  const category = stringValue(body.category, 80);
  const categoryInput = await normalizeImageCategoryInput(admin, body.category_codes, category);
  if (!title) return NextResponse.json({ error: "제목은 필수입니다." }, { status: 400 });
  if (categoryInput.codes.length === 0) return NextResponse.json({ error: "카테고리는 필수입니다." }, { status: 400 });

  const isPublished = Boolean(body.is_published);
  const { data: image, error: imageError } = await admin
    .from("images")
    .update({
      title,
      title_ko: stringValue(body.title_ko, 200) || title,
      title_en: stringValue(body.title_en, 200) || title,
      description: stringValue(body.description, 5000) || null,
      description_ko: stringValue(body.description_ko, 5000) || stringValue(body.description, 5000) || null,
      description_en: stringValue(body.description_en, 5000) || stringValue(body.description, 5000) || null,
      category: categoryInput.primary,
      tags: normalizeTags(body.tags),
      tags_ko: normalizeTags(body.tags_ko),
      tags_en: normalizeTags(body.tags_en),
      is_published: isPublished,
      unpublished_at: isPublished ? null : new Date().toISOString(),
      unpublished_reason: isPublished ? null : "관리자 상세 편집",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, asset_id, title, title_ko, title_en, description, description_ko, description_en, category, tags, tags_ko, tags_en, status, is_published, storage_path_preview")
    .single();

  if (imageError || !image) return NextResponse.json({ error: imageError?.message ?? "Image update failed" }, { status: 500 });

  await syncImageCategoryAssignments(admin, id, categoryInput.codes);
  if (!isPublished) await detachImageFromAboutPage(admin, id);

  const priceOverrides = body.priceOverrides && typeof body.priceOverrides === "object"
    ? body.priceOverrides as Record<string, unknown>
    : {};

  let overrideRows: { image_id: string; license_code: string; price_krw: number; updated_by: string }[];
  try {
    overrideRows = Object.entries(priceOverrides).map(([licenseCode, price]) => ({
      image_id: id,
      license_code: licenseCode,
      price_krw: normalizeLicensePrice(price),
      updated_by: adminUser.id,
    }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid price override" }, { status: 400 });
  }

  const { error: deleteError } = await admin
    .from("image_price_overrides")
    .delete()
    .eq("image_id", id);

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  if (overrideRows.length > 0) {
    const { error: insertError } = await admin
      .from("image_price_overrides")
      .insert(overrideRows);

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    image: {
      ...image,
      category_codes: categoryInput.codes,
      storage_path_preview: previewUrl(image.storage_path_preview),
      price_overrides: overrideRows.map(({ license_code, price_krw }) => ({ license_code, price_krw })),
    },
  });
}
