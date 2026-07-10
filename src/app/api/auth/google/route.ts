import { NextRequest, NextResponse } from "next/server";
import { buildSiteUrl, getCanonicalRedirectOrigin, getSafeRelativePath } from "@/lib/routing/canonical";
import { createClient } from "@/lib/supabase/server";

function cleanText(value: string | null) {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const redirectOrigin = getCanonicalRedirectOrigin(origin);
  const next = getSafeRelativePath(searchParams.get("next"), "/dashboard");
  const role = searchParams.get("role");
  const organization = cleanText(searchParams.get("organization"));
  const phoneNumber = cleanText(searchParams.get("phone_number"));
  const primaryActivityRegions = cleanText(searchParams.get("primary_activity_regions"));
  const bio = cleanText(searchParams.get("bio"));

  const callbackParams = new URLSearchParams();
  callbackParams.set("next", next);
  if (role === "buyer" || role === "photographer") callbackParams.set("role", role);
  if (organization) callbackParams.set("organization", organization);
  if (phoneNumber) callbackParams.set("phone_number", phoneNumber);
  if (primaryActivityRegions) callbackParams.set("primary_activity_regions", primaryActivityRegions);
  if (bio) callbackParams.set("bio", bio);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: buildSiteUrl(`/api/auth/callback?${callbackParams.toString()}`, redirectOrigin),
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(`${redirectOrigin}/login?error=oauth`);
  }

  return NextResponse.redirect(data.url);
}
