import { NextResponse } from "next/server";
import { activePresenceSince } from "@/lib/analytics/presence";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const admin = createAdminClient();
  const since = activePresenceSince().toISOString();
  const { data, error } = await admin
    .from("user_presence")
    .select(`
      session_id, user_id, path, referrer, user_agent, metadata, first_seen_at, last_seen_at,
      user:profiles!user_presence_user_id_fkey(id, full_name, role, avatar_url)
    `)
    .gte("last_seen_at", since)
    .order("last_seen_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    activeWindowSeconds: 120,
    users: data ?? [],
  });
}
