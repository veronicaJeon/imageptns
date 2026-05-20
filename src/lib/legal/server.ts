import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_LEGAL_DOCUMENTS,
  LEGAL_DOCUMENT_SLUGS,
  normalizeLegalDocument,
  type LegalDocumentContent,
  type LegalDocumentSlug,
} from "./content";

interface LegalDocumentRow {
  slug: LegalDocumentSlug;
  title: string | null;
  body: string | null;
  updated_at: string | null;
  published_at: string | null;
}

export interface LegalDocument extends LegalDocumentContent {
  updatedAt: string | null;
  publishedAt: string | null;
}

function rowToDocument(row: LegalDocumentRow): LegalDocument {
  return {
    ...normalizeLegalDocument(row.slug, row),
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
}

export async function getPublicLegalDocument(slug: LegalDocumentSlug): Promise<LegalDocument> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("legal_documents")
    .select("slug, title, body, updated_at, published_at")
    .eq("slug", slug)
    .maybeSingle();

  if (!data) {
    return {
      ...DEFAULT_LEGAL_DOCUMENTS[slug],
      updatedAt: null,
      publishedAt: null,
    };
  }

  return rowToDocument(data as LegalDocumentRow);
}

export async function getAllLegalDocuments(): Promise<LegalDocument[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("legal_documents")
    .select("slug, title, body, updated_at, published_at");

  if (error) throw new Error(error.message);

  const rowsBySlug = new Map(
    ((data ?? []) as LegalDocumentRow[]).map((row) => [row.slug, row]),
  );

  return LEGAL_DOCUMENT_SLUGS.map((slug) => {
    const row = rowsBySlug.get(slug);
    if (!row) {
      return {
        ...DEFAULT_LEGAL_DOCUMENTS[slug],
        updatedAt: null,
        publishedAt: null,
      };
    }
    return rowToDocument(row);
  });
}
