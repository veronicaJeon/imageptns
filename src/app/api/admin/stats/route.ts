import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
  return profile?.is_admin ? user : null;
}

export async function GET(_req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();

  const [
    totalImages, pendingImages, approvedImages, rejectedImages,
    totalUsers, totalOrders, revenueRes, recentUsers,
  ] = await Promise.all([
    admin.from("images").select("id", { count: "exact", head: true }),
    admin.from("images").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("images").select("id", { count: "exact", head: true }).eq("status", "approved"),
    admin.from("images").select("id", { count: "exact", head: true }).eq("status", "rejected"),
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("orders").select("id", { count: "exact", head: true }).eq("status", "completed"),
    admin.from("orders").select("total_krw").eq("status", "completed"),
    admin.from("profiles").select("id, full_name, role, created_at").order("created_at", { ascending: false }).limit(5),
  ]);

  const totalRevenue = (revenueRes.data ?? []).reduce((s: number, o: any) => s + (o.total_krw ?? 0), 0);

  return NextResponse.json({
    images: {
      total:    totalImages.count ?? 0,
      pending:  pendingImages.count ?? 0,
      approved: approvedImages.count ?? 0,
      rejected: rejectedImages.count ?? 0,
    },
    users:   { total: totalUsers.count ?? 0 },
    orders:  { total: totalOrders.count ?? 0, revenue: totalRevenue },
    recentUsers: recentUsers.data ?? [],
  });
}
