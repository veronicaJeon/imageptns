import { NextRequest, NextResponse } from "next/server";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  if (!await requireAdminUser()) return forbidden();
  const admin = createAdminClient();
  const { data, error } = await admin.from("library_guidance_messages").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!await requireAdminUser()) return forbidden();
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const contentKo = typeof body?.content_ko === "string" ? body.content_ko.trim() : "";
  const contentEn = typeof body?.content_en === "string" ? body.content_en.trim() : "";
  if (!contentKo || contentKo.length > 160 || contentEn.length > 160) {
    return NextResponse.json({ error: "안내글은 1~160자로 입력해주세요." }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data, error } = await admin.from("library_guidance_messages").insert({
    content_ko: contentKo,
    content_en: contentEn || null,
    is_active: body?.is_active !== false,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: data }, { status: 201 });
}
