import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const lang = req.nextUrl.searchParams.get("lang") === "en" ? "en" : "ko";
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("library_guidance_messages")
    .select("id, content_ko, content_en")
    .eq("is_active", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const messages = data ?? [];
  if (messages.length === 0) {
    return NextResponse.json({ message: null }, { headers: { "Cache-Control": "no-store" } });
  }
  const selected = messages[Math.floor(Math.random() * messages.length)];
  return NextResponse.json(
    { message: lang === "en" ? selected.content_en || selected.content_ko : selected.content_ko },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
