import { NextRequest, NextResponse } from "next/server";
import { recordAdminAuditLog } from "@/lib/admin/audit";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const { id } = await params;
  const body = await req.json().catch(() => null) as { is_published?: unknown; reason?: unknown } | null;
  if (typeof body?.is_published !== "boolean") {
    return NextResponse.json({ error: "is_published is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: before, error: beforeError } = await admin
    .from("images")
    .select("id, title, is_published, unpublished_at, unpublished_reason")
    .eq("id", id)
    .single();

  if (beforeError) return NextResponse.json({ error: beforeError.message }, { status: 404 });

  const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : null;
  const patch = body.is_published
    ? {
        is_published: true,
        unpublished_at: null,
        unpublished_by: null,
        unpublished_reason: null,
      }
    : {
        is_published: false,
        unpublished_at: new Date().toISOString(),
        unpublished_by: adminUser.id,
        unpublished_reason: reason,
      };

  const { data, error } = await admin
    .from("images")
    .update(patch)
    .eq("id", id)
    .select("id, title, is_published, unpublished_at, unpublished_reason")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAdminAuditLog(admin, {
    actorId: adminUser.id,
    action: body.is_published ? "image.published" : "image.unpublished",
    targetType: "image",
    targetId: id,
    targetLabel: data.title,
    before,
    after: data,
    reason,
  });

  return NextResponse.json({ image: data });
}
