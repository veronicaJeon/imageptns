import { NextResponse } from "next/server";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const admin = createAdminClient();
  const [generalResult, photoResult, paymentResult] = await Promise.all([
    admin
      .from("contact_submissions")
      .select("id", { count: "exact", head: true })
      .eq("inquiry_type", "general")
      .eq("status", "pending"),
    admin
      .from("contact_submissions")
      .select("id", { count: "exact", head: true })
      .eq("inquiry_type", "photo_request")
      .eq("request_status", "submitted"),
    admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("payment_provider", "bank_transfer")
      .eq("offline_payment_status", "requested"),
  ]);

  if (generalResult.error || photoResult.error || paymentResult.error) {
    return NextResponse.json(
      { error: generalResult.error?.message ?? photoResult.error?.message ?? paymentResult.error?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    general: generalResult.count ?? 0,
    photo: photoResult.count ?? 0,
    payment: paymentResult.count ?? 0,
  });
}
