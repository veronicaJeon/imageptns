import "server-only";

import {
  DEFAULT_ABOUT_PAGE_CONTENT,
  normalizeAboutPageContent,
  type AboutPageContent,
} from "./content";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AboutPageAdminState {
  publishedContent: AboutPageContent;
  draftContent: AboutPageContent;
  updatedAt: string | null;
  publishedAt: string | null;
  updatedBy: string | null;
  hasDatabaseRow: boolean;
}

interface AboutPageRow {
  content: unknown;
  draft_content: unknown | null;
  updated_at: string | null;
  published_at: string | null;
  updated_by: string | null;
}

function fallbackState(): AboutPageAdminState {
  return {
    publishedContent: DEFAULT_ABOUT_PAGE_CONTENT,
    draftContent: DEFAULT_ABOUT_PAGE_CONTENT,
    updatedAt: null,
    publishedAt: null,
    updatedBy: null,
    hasDatabaseRow: false,
  };
}

function isMissingAboutPageTableError(message: string) {
  return message.includes("about_page_content")
    && (message.includes("schema cache") || message.includes("does not exist"));
}

async function readAboutPageRow(): Promise<AboutPageRow | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("about_page_content")
      .select("content, draft_content, updated_at, published_at, updated_by")
      .eq("slug", "about")
      .maybeSingle();

    if (error) {
      if (!isMissingAboutPageTableError(error.message)) {
        console.warn("[about-page] Falling back to default content:", error.message);
      }
      return null;
    }

    return (data as AboutPageRow | null) ?? null;
  } catch (error) {
    console.warn("[about-page] Falling back to default content:", error);
    return null;
  }
}

export async function getPublicAboutPageContent(): Promise<AboutPageContent> {
  const row = await readAboutPageRow();
  if (!row?.published_at) return DEFAULT_ABOUT_PAGE_CONTENT;
  return normalizeAboutPageContent(row.content);
}

export async function getAdminAboutPageState(): Promise<AboutPageAdminState> {
  const row = await readAboutPageRow();
  if (!row) return fallbackState();

  const publishedContent = row.published_at
    ? normalizeAboutPageContent(row.content)
    : DEFAULT_ABOUT_PAGE_CONTENT;

  return {
    publishedContent,
    draftContent: normalizeAboutPageContent(row.draft_content ?? row.content),
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    updatedBy: row.updated_by,
    hasDatabaseRow: true,
  };
}
