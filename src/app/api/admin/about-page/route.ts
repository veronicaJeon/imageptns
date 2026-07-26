import { NextRequest, NextResponse } from "next/server";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { recordAdminAuditLog } from "@/lib/admin/audit";
import {
  aboutContentContainsOriginalStorageUrl,
  DEFAULT_ABOUT_PAGE_CONTENT,
  normalizeAboutPageContent,
  type AboutPageContent,
} from "@/lib/about/content";
import {
  removeUnreferencedAboutAssets,
  validateAboutLibraryImages,
} from "@/lib/about/library-assets";
import { getAdminAboutPageState } from "@/lib/about/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const state = await getAdminAboutPageState();
  return NextResponse.json(state);
}

export async function PATCH(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const payload = await req.json().catch(() => null) as { content?: unknown } | null;
  if (aboutContentContainsOriginalStorageUrl(payload?.content)) {
    return NextResponse.json(
      { error: "원본 또는 비공개 스토리지 URL은 회사소개에 게시할 수 없습니다." },
      { status: 400 },
    );
  }
  const draftContent = normalizeAboutPageContent(payload?.content);
  const admin = createAdminClient();
  const now = new Date().toISOString();

  try {
    await validateAboutLibraryImages(admin, draftContent);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "이미지 권한을 확인하지 못했습니다." },
      { status: 400 },
    );
  }

  const { data: before } = await admin
    .from("about_page_content")
    .select("content, draft_content, updated_at, published_at")
    .eq("slug", "about")
    .maybeSingle();

  const mutation = before
    ? admin
      .from("about_page_content")
      .update({
        draft_content: draftContent,
        updated_by: adminUser.id,
        updated_at: now,
      })
      .eq("slug", "about")
    : admin
      .from("about_page_content")
      .insert({
        slug: "about",
        content: DEFAULT_ABOUT_PAGE_CONTENT,
        draft_content: draftContent,
        updated_by: adminUser.id,
        updated_at: now,
      });

  const { data, error } = await mutation
    .select("content, draft_content, updated_at, published_at, updated_by")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await removeUnreferencedAboutAssets(
    admin,
    [
      before ? normalizeAboutPageContent(before.content) : null,
      before ? normalizeAboutPageContent(before.draft_content ?? before.content) : null,
    ],
    [
      before ? normalizeAboutPageContent(before.content) : DEFAULT_ABOUT_PAGE_CONTENT,
      draftContent,
    ],
  );

  await recordAdminAuditLog(admin, {
    actorId: adminUser.id,
    action: "about_page.draft_saved",
    targetType: "about_page",
    targetId: "about",
    targetLabel: "회사소개",
    before: before ?? null,
    after: data as Record<string, unknown>,
  });

  return NextResponse.json({ draftContent, updatedAt: now });
}

export async function POST(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const payload = await req.json().catch(() => null) as { action?: unknown; content?: unknown } | null;
  if (payload?.action !== "publish") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }
  if (aboutContentContainsOriginalStorageUrl(payload.content)) {
    return NextResponse.json(
      { error: "원본 또는 비공개 스토리지 URL은 회사소개에 게시할 수 없습니다." },
      { status: 400 },
    );
  }

  const content: AboutPageContent = normalizeAboutPageContent(payload.content);
  const admin = createAdminClient();
  const now = new Date().toISOString();

  try {
    await validateAboutLibraryImages(admin, content);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "이미지 권한을 확인하지 못했습니다." },
      { status: 400 },
    );
  }

  const { data: before } = await admin
    .from("about_page_content")
    .select("content, draft_content, updated_at, published_at")
    .eq("slug", "about")
    .maybeSingle();

  const { data, error } = await admin
    .from("about_page_content")
    .upsert({
      slug: "about",
      content,
      draft_content: content,
      updated_by: adminUser.id,
      updated_at: now,
      published_at: now,
    }, { onConflict: "slug" })
    .select("content, draft_content, updated_at, published_at, updated_by")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await removeUnreferencedAboutAssets(
    admin,
    [
      before ? normalizeAboutPageContent(before.content) : null,
      before ? normalizeAboutPageContent(before.draft_content ?? before.content) : null,
    ],
    [content, content],
  );

  await recordAdminAuditLog(admin, {
    actorId: adminUser.id,
    action: "about_page.published",
    targetType: "about_page",
    targetId: "about",
    targetLabel: "회사소개",
    before: before ?? null,
    after: data as Record<string, unknown>,
  });

  return NextResponse.json({ publishedContent: content, publishedAt: now, updatedAt: now });
}
