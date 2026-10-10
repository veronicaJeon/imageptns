import "server-only";

import { createHash } from "node:crypto";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { storageBinaryBody } from "@/lib/supabase/storage-body";
import { getCopyrightLicense } from "@/lib/licenses/creative-commons";
import { siteAssetUrl } from "@/lib/about/library-assets";
import { DEFAULT_AUTH_PAGE_CONTENT, normalizeAuthPageContent, type AuthPageContent, type AuthPageKey } from "./page-content";

type AdminClient = ReturnType<typeof createAdminClient>;
interface ImageRow {
  id:string; asset_id:string|null; title:string; status:string; lifecycle_status:string|null; is_published:boolean;
  promotional_use_allowed:boolean; promotional_use_consented_at:string|null; promotional_use_consent_version:string|null;
  promotional_use_revoked_at:string|null; promotional_use_basis:string|null; attribution_name:string|null; copyright_license:string|null;
  storage_path_original:string|null; storage_path_full:string|null; photographer?:{full_name:string|null}|{full_name:string|null}[]|null;
}
export const AUTH_PAGE_IMAGE_SLOTS = ["login", "signup"] as const;
export function isAuthPageImageSlot(value: unknown): value is AuthPageKey { return typeof value === "string" && AUTH_PAGE_IMAGE_SLOTS.includes(value as AuthPageKey); }
function eligible(image: ImageRow) { return image.status === "approved" && image.lifecycle_status === "active" && image.is_published && image.promotional_use_allowed && Boolean(image.promotional_use_consented_at) && Boolean(image.promotional_use_consent_version) && Boolean(image.promotional_use_basis) && !image.promotional_use_revoked_at && Boolean(image.storage_path_original ?? image.storage_path_full); }

export async function createAuthLibraryAsset(admin: AdminClient, imageId: string, slot: AuthPageKey) {
  const { data, error } = await admin.from("images").select("id,asset_id,title,status,lifecycle_status,is_published,promotional_use_allowed,promotional_use_consented_at,promotional_use_consent_version,promotional_use_revoked_at,promotional_use_basis,attribution_name,copyright_license,storage_path_original,storage_path_full,photographer:profiles!photographer_id(full_name)").eq("id", imageId).single();
  if (error || !data) throw new Error(error?.message ?? "이미지를 찾을 수 없습니다.");
  const image = data as ImageRow;
  if (!eligible(image)) throw new Error("공개 중이며 홍보 활용에 동의한 승인 이미지만 선택할 수 있습니다.");
  const sourcePath = image.storage_path_original ?? image.storage_path_full;
  const { data: original, error: downloadError } = await admin.storage.from("images-original").download(sourcePath!);
  if (downloadError || !original) throw new Error(downloadError?.message ?? "원본을 읽지 못했습니다.");
  const source = Buffer.from(await original.arrayBuffer());
  const digest = createHash("sha256").update(source).update(`auth-site-asset-v1:${slot}:1920`).digest("hex").slice(0, 16);
  const derivedPath = `auth/${slot}/${image.id}-${digest}.webp`;
  const derivative = await sharp(source).rotate().resize({ width: 1920, withoutEnlargement: true }).webp({ quality: 84, effort: 4 }).toBuffer();
  const { error: uploadError } = await admin.storage.from("site-assets").upload(derivedPath, storageBinaryBody(derivative), { contentType: "image/webp", cacheControl: "31536000", upsert: true });
  if (uploadError) throw new Error(uploadError.message);
  const license = getCopyrightLicense(image.copyright_license);
  return { imageId:image.id, assetId:image.asset_id, title:image.title, derivedPath, url:siteAssetUrl(derivedPath), credit:image.attribution_name ?? (Array.isArray(image.photographer) ? image.photographer[0]?.full_name : image.photographer?.full_name) ?? null, licenseCode:license.code, licenseLabel:license.label, licenseUrl:license.url };
}

export async function validateAuthLibraryImages(admin: AdminClient, content: AuthPageContent) {
  const selections = AUTH_PAGE_IMAGE_SLOTS.map((slot) => ({ slot, source:content.pages[slot].backgroundImageSource })).filter((item) => item.source.source === "library");
  if (!selections.length) return;
  const { data, error } = await admin.from("images").select("id,status,lifecycle_status,is_published,promotional_use_allowed,promotional_use_consented_at,promotional_use_consent_version,promotional_use_revoked_at,promotional_use_basis,storage_path_original,storage_path_full").in("id", selections.map((item) => item.source.imageId!));
  if (error) throw new Error(error.message);
  const images = new Map((data ?? []).map((image) => [image.id, image as ImageRow]));
  for (const { slot, source } of selections) {
    const image = images.get(source.imageId!);
    if (!image || !eligible(image)) throw new Error(`${slot} 이미지의 홍보 활용 권한 또는 공개 상태를 다시 확인해 주세요.`);
    if (!source.derivedPath?.startsWith(`auth/${slot}/${source.imageId}-`) || content.pages[slot].backgroundImageUrl !== siteAssetUrl(source.derivedPath)) throw new Error(`${slot} 이미지 파생 파일 정보가 올바르지 않습니다.`);
  }
}

function paths(...contents: Array<AuthPageContent|null|undefined>) { return new Set(contents.flatMap((content) => content ? AUTH_PAGE_IMAGE_SLOTS.map((slot) => content.pages[slot].backgroundImageSource.derivedPath).filter((path):path is string=>Boolean(path)) : [])); }
export async function removeUnreferencedAuthAssets(admin: AdminClient, previous:Array<AuthPageContent|null|undefined>, current:Array<AuthPageContent|null|undefined>) { const before=paths(...previous), after=paths(...current), stale=[...before].filter((path)=>!after.has(path)); if(stale.length) await admin.storage.from("site-assets").remove(stale); return stale; }

export async function detachImageFromAuthPages(admin: AdminClient, imageId: string) {
  const { data:row, error } = await admin.from("auth_page_content").select("content,draft_content").eq("slug","auth").maybeSingle();
  if(error || !row) return { changed:false, removedPaths:[] as string[] };
  const published=normalizeAuthPageContent(row.content), draft=normalizeAuthPageContent(row.draft_content ?? row.content), removed=new Set<string>(), detach=(content:AuthPageContent)=>{ const next=structuredClone(content); for(const slot of AUTH_PAGE_IMAGE_SLOTS){ const source=next.pages[slot].backgroundImageSource; if(source.source!=="library" || source.imageId!==imageId) continue; if(source.derivedPath) removed.add(source.derivedPath); next.pages[slot]={...next.pages[slot], backgroundImageUrl:"", backgroundImageAlt:"", backgroundImageSource:{...DEFAULT_AUTH_PAGE_CONTENT.pages[slot].backgroundImageSource}}; } return next; };
  const nextPublished=detach(published), nextDraft=detach(draft); if(!removed.size) return { changed:false, removedPaths:[] as string[] };
  const { error:updateError }=await admin.from("auth_page_content").update({content:nextPublished,draft_content:nextDraft,updated_at:new Date().toISOString()}).eq("slug","auth"); if(updateError) throw new Error(updateError.message);
  const removedPaths=[...removed]; const { error:removeError }=await admin.storage.from("site-assets").remove(removedPaths); if(removeError) throw new Error(removeError.message); return { changed:true, removedPaths };
}
