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

// Public: list published notices
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const popupOnly = searchParams.get("popup") === "1";
  const supabase = await createClient();

  let query = supabase
    .from("notices")
    .select("id, title, body, is_popup, published_at, created_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  if (popupOnly) query = query.eq("is_popup", true).limit(1);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notices: data ?? [] });
}

// Admin: create notice
export async function POST(req: NextRequest) {
  const adminUser = await getAdminUser();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { title, body, is_popup = false, is_published = false } = await req.json();
  if (!title?.trim() || !body?.trim()) {
    return NextResponse.json({ error: "title and body required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("notices")
    .insert({
      title: title.trim(),
      body: body.trim(),
      is_popup,
      is_published,
      published_at: is_published ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notice: data }, { status: 201 });
}
