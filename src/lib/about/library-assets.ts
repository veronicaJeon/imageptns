import "server-only";

import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  DEFAULT_ABOUT_PAGE_CONTENT,
  normalizeAboutPageContent,
  type AboutImageSlot,
  type AboutPageContent,
} from "./content";
import { createAdminClient } from "@/lib/supabase/admin";

export const ABOUT_IMAGE_SLOTS = ["hero", "editorial", "desk"] as const;

const SLOT_WIDTHS: Record<AboutImageSlot, number> = {
  hero: 1920,
  editorial: 1200,
  desk: 1200,
};

type AdminClient = ReturnType<typeof createAdminClient>;

interface LibraryImageRow {
  id: string;
  asset_id: string | null;
  title: string;
  status: string;
  lifecycle_status: string | null;
  is_published: boolean;
  promotional_use_allowed: boolean;
  promotional_use_consented_at: string | null;
  promotional_use_consent_version: string | null;
  promotional_use_revoked_at: string | null;
  attribution_name: string | null;
  photographer?: { full_name: string | null } | { full_name: string | null }[] | null;
  storage_path_original: string | null;
  storage_path_full: string | null;
}

export function isAboutImageSlot(value: unknown): value is AboutImageSlot {
  return typeof value === "string" && ABOUT_IMAGE_SLOTS.includes(value as AboutImageSlot);
}

export function siteAssetUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");
  return `${base}/storage/v1/object/public/site-assets/${path}`;
}

function libraryImageIsEligible(image: LibraryImageRow) {
  return image.status === "approved" &&
    image.lifecycle_status === "active" &&
    image.is_published === true &&
    image.promotional_use_allowed === true &&
    Boolean(image.promotional_use_consented_at) &&
    Boolean(image.promotional_use_consent_version) &&
    !image.promotional_use_revoked_at &&
    Boolean(image.storage_path_original ?? image.storage_path_full);
}

export async function createAboutLibraryAsset(
  admin: AdminClient,
  imageId: string,
  slot: AboutImageSlot,
) {
  const { data, error } = await admin
    .from("images")
    .select("id, asset_id, title, status, lifecycle_status, is_published, promotional_use_allowed, promotional_use_consented_at, promotional_use_consent_version, promotional_use_revoked_at, attribution_name, storage_path_original, storage_path_full, photographer:profiles!photographer_id(full_name)")
    .eq("id", imageId)
    .single();

  if (error || !data) throw new Error(error?.message ?? "이미지를 찾을 수 없습니다.");
  const image = data as LibraryImageRow;
  if (!libraryImageIsEligible(image)) {
    throw new Error("공개 중이며 홍보 활용에 동의한 승인 이미지만 선택할 수 있습니다.");
  }

  const originalPath = image.storage_path_original ?? image.storage_path_full;
  const { data: original, error: downloadError } = await admin.storage
    .from("images-original")
    .download(originalPath!);
  if (downloadError || !original) {
    throw new Error(downloadError?.message ?? "원본을 읽지 못했습니다.");
  }

  const source = Buffer.from(await original.arrayBuffer());
  const digest = createHash("sha256")
    .update(source)
    .update(`about-site-asset-v1:${slot}:${SLOT_WIDTHS[slot]}`)
    .digest("hex")
    .slice(0, 16);
  const derivedPath = `about/${slot}/${image.id}-${digest}.webp`;
  const derivative = await sharp(source)
    .rotate()
    .resize({ width: SLOT_WIDTHS[slot], withoutEnlargement: true })
    .webp({ quality: 84, effort: 4 })
    .toBuffer();

  const { error: uploadError } = await admin.storage
    .from("site-assets")
    .upload(derivedPath, derivative, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: true,
    });
  if (uploadError) throw new Error(uploadError.message);

  return {
    imageId: image.id,
    assetId: image.asset_id,
    title: image.title,
    derivedPath,
    url: siteAssetUrl(derivedPath),
    credit: image.attribution_name
      ?? (Array.isArray(image.photographer) ? image.photographer[0]?.full_name : image.photographer?.full_name)
      ?? null,
  };
}

export async function validateAboutLibraryImages(admin: AdminClient, content: AboutPageContent) {
  const selections = ABOUT_IMAGE_SLOTS
    .map((slot) => ({ slot, source: content.imageSources[slot] }))
    .filter((item) => item.source.source === "library");
  if (selections.length === 0) return;

  const ids = Array.from(new Set(selections.map((item) => item.source.imageId!)));
  const { data, error } = await admin
    .from("images")
    .select("id, status, lifecycle_status, is_published, promotional_use_allowed, promotional_use_consented_at, promotional_use_consent_version, promotional_use_revoked_at, storage_path_original, storage_path_full")
    .in("id", ids);
  if (error) throw new Error(error.message);

  const images = new Map((data ?? []).map((image) => [image.id, image as LibraryImageRow]));
  for (const { slot, source } of selections) {
    const image = images.get(source.imageId!);
    if (!image || !libraryImageIsEligible(image)) {
      throw new Error(`${slot} 이미지의 홍보 활용 권한 또는 공개 상태를 다시 확인해 주세요.`);
    }
    if (!source.derivedPath?.startsWith(`about/${slot}/${source.imageId}-`)) {
      throw new Error(`${slot} 이미지 파생 경로가 올바르지 않습니다.`);
    }
    if (content.images[slot] !== siteAssetUrl(source.derivedPath)) {
      throw new Error(`${slot} 이미지 URL과 파생 파일 정보가 일치하지 않습니다.`);
    }
  }
}

function referencedDerivedPaths(...contents: Array<AboutPageContent | null | undefined>) {
  return new Set(contents.flatMap((content) => (
    content
      ? ABOUT_IMAGE_SLOTS.map((slot) => content.imageSources[slot].derivedPath).filter((path): path is string => Boolean(path))
      : []
  )));
}

export async function removeUnreferencedAboutAssets(
  admin: AdminClient,
  previous: Array<AboutPageContent | null | undefined>,
  current: Array<AboutPageContent | null | undefined>,
) {
  const before = referencedDerivedPaths(...previous);
  const after = referencedDerivedPaths(...current);
  const stale = Array.from(before).filter((path) => !after.has(path));
  if (stale.length > 0) await admin.storage.from("site-assets").remove(stale);
  return stale;
}

export async function detachImageFromAboutPage(admin: AdminClient, imageId: string) {
  const { data: row, error } = await admin
    .from("about_page_content")
    .select("content, draft_content")
    .eq("slug", "about")
    .maybeSingle();
  if (error || !row) return { changed: false, removedPaths: [] as string[] };

  const published = normalizeAboutPageContent(row.content);
  const draft = normalizeAboutPageContent(row.draft_content ?? row.content);
  const removedPaths = new Set<string>();
  let changed = false;

  const detach = (content: AboutPageContent) => {
    const next = structuredClone(content);
    for (const slot of ABOUT_IMAGE_SLOTS) {
      const source = next.imageSources[slot];
      if (source.source !== "library" || source.imageId !== imageId) continue;
      if (source.derivedPath) removedPaths.add(source.derivedPath);
      next.images[slot] = DEFAULT_ABOUT_PAGE_CONTENT.images[slot];
      next.imageSources[slot] = { source: "external", imageId: null, derivedPath: null, credit: null };
      changed = true;
    }
    return next;
  };

  const nextPublished = detach(published);
  const nextDraft = detach(draft);
  if (!changed) return { changed: false, removedPaths: [] as string[] };

  const { error: updateError } = await admin
    .from("about_page_content")
    .update({
      content: nextPublished,
      draft_content: nextDraft,
      updated_at: new Date().toISOString(),
    })
    .eq("slug", "about");
  if (updateError) throw new Error(updateError.message);
  const paths = Array.from(removedPaths);
  if (paths.length > 0) {
    const { error: removeError } = await admin.storage.from("site-assets").remove(paths);
    if (removeError) throw new Error(removeError.message);
  }
  return { changed: true, removedPaths: paths };
}
