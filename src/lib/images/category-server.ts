import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_IMAGE_CATEGORIES,
  categoryAssignmentRows,
  normalizeCategoryCodes,
  primaryCategoryCode,
  type ImageCategory,
} from "./categories";

type AdminClient = ReturnType<typeof createAdminClient>;

interface CategoryRow {
  code: string;
  label_ko: string;
  label_en: string;
  sort_order: number;
  active: boolean;
}

interface AssignmentRow {
  image_id: string;
  category_code: string;
  is_primary: boolean;
}

function isMissingCategorySchema(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "42P01" || /image_(categories|category_assignments)/i.test(error?.message ?? "");
}

export function defaultImageCategories(): ImageCategory[] {
  return DEFAULT_IMAGE_CATEGORIES.map((category, index) => ({
    code: category.code,
    ko: category.ko,
    en: category.en,
    sort_order: (index + 1) * 10,
    active: true,
  }));
}

function toCategory(row: CategoryRow): ImageCategory {
  return {
    code: row.code,
    ko: row.label_ko,
    en: row.label_en,
    sort_order: row.sort_order,
    active: row.active,
  };
}

export async function listImageCategories(admin: AdminClient, includeInactive = false) {
  let query = admin
    .from("image_categories")
    .select("code, label_ko, label_en, sort_order, active")
    .order("sort_order", { ascending: true })
    .order("code", { ascending: true });

  if (!includeInactive) query = query.eq("active", true);

  const { data, error } = await query;
  if (error) {
    if (isMissingCategorySchema(error)) return defaultImageCategories();
    throw error;
  }

  return ((data ?? []) as CategoryRow[]).map(toCategory);
}

export async function activeCategoryCodeSet(admin: AdminClient) {
  const categories = await listImageCategories(admin, false);
  return new Set(categories.map((category) => category.code));
}

export async function normalizeImageCategoryInput(
  admin: AdminClient,
  categoryCodes: unknown,
  legacyCategory: unknown,
) {
  const allowedCodes = await activeCategoryCodeSet(admin);
  const fallback = DEFAULT_IMAGE_CATEGORIES[0].code;
  const requested = Array.isArray(categoryCodes) ? categoryCodes : [legacyCategory].filter(Boolean);
  const codes = normalizeCategoryCodes(requested, allowedCodes);
  if (requested.length > 0 && codes.length === 0) {
    return { codes: [], primary: "" };
  }

  const finalCodes = codes.length > 0 ? codes : normalizeCategoryCodes([fallback], allowedCodes);
  const primary = primaryCategoryCode(finalCodes, fallback, allowedCodes);
  return { codes: finalCodes.length > 0 ? finalCodes : [fallback], primary };
}

export async function syncImageCategoryAssignments(
  admin: AdminClient,
  imageId: string,
  categoryCodes: string[],
) {
  const rows = categoryAssignmentRows(imageId, categoryCodes);

  const { error: deleteError } = await admin
    .from("image_category_assignments")
    .delete()
    .eq("image_id", imageId);

  if (deleteError) {
    if (isMissingCategorySchema(deleteError)) return;
    throw deleteError;
  }

  if (rows.length === 0) return;

  const { error: insertError } = await admin
    .from("image_category_assignments")
    .insert(rows);

  if (insertError) throw insertError;
}

export async function getImageCategoryCodeMap(admin: AdminClient, imageIds: string[]) {
  if (imageIds.length === 0) return new Map<string, string[]>();

  const { data, error } = await admin
    .from("image_category_assignments")
    .select("image_id, category_code, is_primary")
    .in("image_id", imageIds);

  if (error) {
    if (isMissingCategorySchema(error)) return new Map<string, string[]>();
    throw error;
  }

  const grouped = new Map<string, AssignmentRow[]>();
  for (const row of (data ?? []) as AssignmentRow[]) {
    grouped.set(row.image_id, [...(grouped.get(row.image_id) ?? []), row]);
  }

  const result = new Map<string, string[]>();
  for (const [imageId, rows] of grouped.entries()) {
    result.set(
      imageId,
      rows
        .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.category_code.localeCompare(b.category_code))
        .map((row) => row.category_code),
    );
  }

  return result;
}

export function categoryCodesForImage(
  categoryMap: Map<string, string[]>,
  imageId: string,
  fallbackCategory: string | null | undefined,
) {
  const assigned = categoryMap.get(imageId) ?? [];
  return assigned.length > 0 ? assigned : normalizeCategoryCodes([fallbackCategory]);
}

export async function getImageIdsForCategory(admin: AdminClient, categoryCode: string) {
  const { data, error } = await admin
    .from("image_category_assignments")
    .select("image_id")
    .eq("category_code", categoryCode);

  if (error) {
    if (isMissingCategorySchema(error)) return null;
    throw error;
  }

  return Array.from(new Set(((data ?? []) as { image_id: string }[]).map((row) => row.image_id)));
}
