import { NextRequest, NextResponse } from "next/server";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

function normalized(value: string | null) {
  return (value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
}

export async function GET(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const query = normalized(req.nextUrl.searchParams.get("q"));
  const region = normalized(req.nextUrl.searchParams.get("region"));
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, organization, bio, primary_activity_regions")
    .contains("roles", ["photographer"])
    .eq("photographer_status", "approved")
    .is("deleted_at", null)
    .order("full_name", { ascending: true })
    .limit(300);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const photographers = (data ?? []).filter((photographer) => {
    const regions = (photographer.primary_activity_regions ?? []).map((item: string) => normalized(item));
    const matchesRegion = !region || regions.some((item: string) => item.includes(region) || region.includes(item));
    const haystack = normalized([
      photographer.full_name,
      photographer.organization,
      photographer.bio,
      ...(photographer.primary_activity_regions ?? []),
    ].filter(Boolean).join(" "));
    return matchesRegion && (!query || haystack.includes(query));
  }).slice(0, 100);

  return NextResponse.json({ photographers });
}
