import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = createAdminClient();
  const imageIds = (req.nextUrl.searchParams.get("imageIds") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const { data, error } = await admin
    .from("license_types")
    .select("code, name_en, name_ko, price_krw, description_en, description_ko")
    .order("id", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (imageIds.length === 0) {
    return NextResponse.json({ licenses: data ?? [], overrides: [] });
  }

  const { data: overrides, error: overridesError } = await admin
    .from("image_price_overrides")
    .select("image_id, license_code, price_krw")
    .in("image_id", imageIds);

  if (overridesError) return NextResponse.json({ error: overridesError.message }, { status: 500 });

  return NextResponse.json({ licenses: data ?? [], overrides: overrides ?? [] });
}
