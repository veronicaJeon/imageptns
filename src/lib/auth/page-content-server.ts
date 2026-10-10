import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_AUTH_PAGE_CONTENT, normalizeAuthPageContent, type AuthPageContent } from "./page-content";

interface AuthPageRow { content: unknown; draft_content: unknown | null; updated_at: string | null; published_at: string | null; updated_by: string | null }

async function readRow(): Promise<AuthPageRow | null> {
  try {
    const { data, error } = await createAdminClient().from("auth_page_content")
      .select("content,draft_content,updated_at,published_at,updated_by").eq("slug", "auth").maybeSingle();
    if (error) return null;
    return data as AuthPageRow | null;
  } catch { return null; }
}

export async function getPublicAuthPageContent(): Promise<AuthPageContent> {
  const row = await readRow();
  return row?.published_at ? normalizeAuthPageContent(row.content) : DEFAULT_AUTH_PAGE_CONTENT;
}

export async function getAdminAuthPageState() {
  const row = await readRow();
  return {
    publishedContent: row?.published_at ? normalizeAuthPageContent(row.content) : DEFAULT_AUTH_PAGE_CONTENT,
    draftContent: row ? normalizeAuthPageContent(row.draft_content ?? row.content) : DEFAULT_AUTH_PAGE_CONTENT,
    updatedAt: row?.updated_at ?? null,
    publishedAt: row?.published_at ?? null,
    updatedBy: row?.updated_by ?? null,
    hasDatabaseRow: Boolean(row),
  };
}
