import { NextRequest, NextResponse } from "next/server";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const targetType = req.nextUrl.searchParams.get("targetType");
  const admin = createAdminClient();
  let query = admin
    .from("admin_audit_logs")
    .select("*, actor:profiles!admin_audit_logs_actor_id_fkey(id, full_name)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (targetType && targetType !== "all") query = query.eq("target_type", targetType);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ logs: data ?? [] });
}
