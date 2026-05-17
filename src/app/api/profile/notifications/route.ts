import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.notif_sales       === "boolean") update.notif_sales       = body.notif_sales;
  if (typeof body.notif_reviews     === "boolean") update.notif_reviews     = body.notif_reviews;
  if (typeof body.notif_newsletter  === "boolean") update.notif_newsletter  = body.notif_newsletter;

  const { data, error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id)
    .select("notif_sales, notif_reviews, notif_newsletter")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notifications: data });
}
