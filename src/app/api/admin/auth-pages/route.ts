import { NextRequest, NextResponse } from "next/server";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { recordAdminAuditLog } from "@/lib/admin/audit";
import { DEFAULT_AUTH_PAGE_CONTENT, isSafeAuthBackgroundUrl, normalizeAuthPageContent } from "@/lib/auth/page-content";
import { getAdminAuthPageState } from "@/lib/auth/page-content-server";
import { removeUnreferencedAuthAssets, validateAuthLibraryImages } from "@/lib/auth/library-assets";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  if (!await requireAdminUser()) return forbidden();
  return NextResponse.json(await getAdminAuthPageState());
}

function invalidUrl(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const pages = (value as Record<string, unknown>).pages;
  if (!pages || typeof pages !== "object") return false;
  return (["login", "signup"] as const).some((page) => {
    const panel = (pages as Record<string, unknown>)[page];
    if (!panel || typeof panel !== "object") return false;
    const url = (panel as Record<string, unknown>).backgroundImageUrl;
    return typeof url === "string" && !isSafeAuthBackgroundUrl(url.trim());
  });
}

async function mutate(req: NextRequest, publish: boolean) {
  const user = await requireAdminUser();
  if (!user) return forbidden();
  const payload = await req.json().catch(() => null) as { content?: unknown } | null;
  if (invalidUrl(payload?.content)) return NextResponse.json({ error: "공개 가능한 이미지 URL만 사용할 수 있습니다." }, { status: 400 });
  const content = normalizeAuthPageContent(payload?.content);
  const admin = createAdminClient(), now = new Date().toISOString();
  const { data: before } = await admin.from("auth_page_content").select("content,draft_content,published_at").eq("slug", "auth").maybeSingle();
  try {
    await validateAuthLibraryImages(admin, content);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "라이브러리 이미지 정보를 확인해 주세요." }, { status: 400 });
  }
  const previousPublished = normalizeAuthPageContent(before?.content ?? DEFAULT_AUTH_PAGE_CONTENT);
  const previousDraft = normalizeAuthPageContent(before?.draft_content ?? before?.content ?? DEFAULT_AUTH_PAGE_CONTENT);
  const values = publish
    ? { slug: "auth", content, draft_content: content, updated_by: user.id, updated_at: now, published_at: now }
    : { slug: "auth", content: before?.content ?? DEFAULT_AUTH_PAGE_CONTENT, draft_content: content, updated_by: user.id, updated_at: now, published_at: before?.published_at ?? null };
  const { data, error } = await admin.from("auth_page_content").upsert(values, { onConflict: "slug" }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await removeUnreferencedAuthAssets(
    admin,
    [previousPublished, previousDraft],
    publish ? [content, content] : [previousPublished, content],
  );
  await recordAdminAuditLog(admin, { actorId: user.id, action: publish ? "auth_pages.published" : "auth_pages.draft_saved", targetType: "auth_pages", targetId: "auth", targetLabel: "로그인·회원가입 화면", before: before ?? null, after: data as Record<string, unknown> });
  return NextResponse.json(publish ? { publishedContent: content, publishedAt: now, updatedAt: now } : { draftContent: content, updatedAt: now });
}

export async function PATCH(req: NextRequest) { return mutate(req, false); }
export async function POST(req: NextRequest) { return mutate(req, true); }
