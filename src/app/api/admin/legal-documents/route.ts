import { NextRequest, NextResponse } from "next/server";
import { recordAdminAuditLog } from "@/lib/admin/audit";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { isLegalDocumentSlug, normalizeLegalDocument } from "@/lib/legal/content";
import { getAllLegalDocuments } from "@/lib/legal/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  try {
    const documents = await getAllLegalDocuments();
    return NextResponse.json({ documents });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load legal documents" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const payload = await req.json() as {
    slug?: unknown;
    title?: unknown;
    body?: unknown;
  };

  if (typeof payload.slug !== "string" || !isLegalDocumentSlug(payload.slug)) {
    return NextResponse.json({ error: "Invalid legal document slug" }, { status: 400 });
  }

  const document = normalizeLegalDocument(payload.slug, {
    title: typeof payload.title === "string" ? payload.title : null,
    body: typeof payload.body === "string" ? payload.body : null,
  });

  const admin = createAdminClient();
  const { data: before } = await admin
    .from("legal_documents")
    .select("slug, title, body, updated_at, published_at")
    .eq("slug", document.slug)
    .maybeSingle();

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("legal_documents")
    .upsert({
      slug: document.slug,
      title: document.title,
      body: document.body,
      updated_by: adminUser.id,
      published_at: now,
      updated_at: now,
    })
    .select("slug, title, body, updated_at, published_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAdminAuditLog(admin, {
    actorId: adminUser.id,
    action: "legal_document.updated",
    targetType: "legal_document",
    targetId: document.slug,
    targetLabel: document.title,
    before: before ?? null,
    after: data,
  });

  return NextResponse.json({ document: data });
}
