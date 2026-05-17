import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function getAdminUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
  return data?.is_admin ? user : null;
}

// Admin: update notice
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await getAdminUser();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const allowed: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("title"        in body) allowed.title        = body.title;
  if ("body"         in body) allowed.body         = body.body;
  if ("is_popup"     in body) allowed.is_popup     = body.is_popup;
  if ("is_published" in body) {
    allowed.is_published = body.is_published;
    if (body.is_published && !body.published_at) {
      allowed.published_at = new Date().toISOString();
    }
  }

  const admin = createAdminClient();
  const { data, error } = await admin.from("notices").update(allowed).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notice: data });
}

// Admin: delete notice
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await getAdminUser();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const admin = createAdminClient();
  const { error } = await admin.from("notices").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
