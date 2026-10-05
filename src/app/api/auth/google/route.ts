import { NextRequest, NextResponse } from "next/server";
import { buildSiteUrl, getCanonicalRedirectOrigin, getSafeRelativePath } from "@/lib/routing/canonical";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const redirectOrigin = getCanonicalRedirectOrigin(origin);
  const next = getSafeRelativePath(searchParams.get("next"), "/dashboard");
  const role = searchParams.get("role");

  // Only the role is forwarded. Personal fields are collected after sign-in so
  // they never land in OAuth redirect URLs, browser history or request logs.
  const callbackParams = new URLSearchParams();
  callbackParams.set("next", next);
  if (role === "buyer" || role === "photographer") callbackParams.set("role", role);

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
