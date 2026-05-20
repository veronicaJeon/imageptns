import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface PhotographerCountRow {
  photographer_id: string | null;
}

export async function GET() {
  const admin = createAdminClient();

  const [imagesRes, photographersRes, ordersRes] = await Promise.all([
    admin
      .from("images")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved")
      .eq("lifecycle_status", "active"),
    admin
      .from("images")
      .select("photographer_id")
      .eq("status", "approved")
      .eq("lifecycle_status", "active"),
    admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed"),
  ]);

  const photographerCount = new Set(
    ((photographersRes.data ?? []) as PhotographerCountRow[]).map((r) => r.photographer_id)
  ).size;

  return NextResponse.json({
    images:        imagesRes.count ?? 0,
    photographers: photographerCount,
    orders:        ordersRes.count ?? 0,
  });
}
