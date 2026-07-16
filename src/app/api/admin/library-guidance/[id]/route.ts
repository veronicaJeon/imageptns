import { NextRequest, NextResponse } from "next/server";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!await requireAdminUser()) return forbidden();
  const { id } = await context.params;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("content_ko" in (body ?? {})) {
    const value = typeof body?.content_ko === "string" ? body.content_ko.trim() : "";
    if (!value || value.length > 160) return NextResponse.json({ error: "한국어 안내글은 1~160자로 입력해주세요." }, { status: 400 });
    update.content_ko = value;
  }
  if ("content_en" in (body ?? {})) {
    const value = typeof body?.content_en === "string" ? body.content_en.trim() : "";
    if (value.length > 160) return NextResponse.json({ error: "영문 안내글은 160자 이내로 입력해주세요." }, { status: 400 });
    update.content_en = value || null;
  }
  if (typeof body?.is_active === "boolean") update.is_active = body.is_active;

  const admin = createAdminClient();
  const { data, error } = await admin.from("library_guidance_messages").update(update).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: data });
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!await requireAdminUser()) return forbidden();
  const { id } = await context.params;
  const admin = createAdminClient();
  const { error } = await admin.from("library_guidance_messages").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
