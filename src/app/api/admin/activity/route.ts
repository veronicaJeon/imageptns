import { NextRequest, NextResponse } from "next/server";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const userId = req.nextUrl.searchParams.get("userId");
  const eventType = req.nextUrl.searchParams.get("eventType");
  const admin = createAdminClient();

  let query = admin
    .from("user_events")
    .select(`
      id, user_id, session_id, event_type, path, image_id, order_id,
      referrer, user_agent, metadata, created_at,
      user:profiles!user_events_user_id_fkey(id, full_name, role),
      image:images!user_events_image_id_fkey(id, title, asset_id)
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  if (userId) query = query.eq("user_id", userId);
  if (eventType && eventType !== "all") query = query.eq("event_type", eventType);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ events: data ?? [] });
}
