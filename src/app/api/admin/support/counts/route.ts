import { NextResponse } from "next/server";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const admin = createAdminClient();
  const [generalResult, photoResult] = await Promise.all([
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
  ]);

  if (generalResult.error || photoResult.error) {
    return NextResponse.json(
      { error: generalResult.error?.message ?? photoResult.error?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    general: generalResult.count ?? 0,
    photo: photoResult.count ?? 0,
  });
}
