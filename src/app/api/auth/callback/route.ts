import { NextResponse } from "next/server";
import {
  getCanonicalRedirectOrigin,
  getSafeRelativePath,
} from "@/lib/routing/canonical";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const role = searchParams.get("role"); // "buyer" | "photographer" — passed via redirectTo
  const organization = searchParams.get("organization")?.trim().replace(/\s+/g, " ") ?? "";
  const next = getSafeRelativePath(searchParams.get("next"), "/dashboard");
  const redirectOrigin = getCanonicalRedirectOrigin(origin);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // For Google OAuth with a selected role: update both user metadata AND profiles table.
      // The DB trigger already ran at user-creation time (before the callback),
      // so we must update the profile row directly to save the correct role.
      if ((role && (role === "buyer" || role === "photographer")) || organization) {
        await supabase.auth.updateUser({ data: { ...(role ? { role } : {}), ...(organization ? { organization } : {}) } });

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const patch: Record<string, string> = {};
          if (role && (role === "buyer" || role === "photographer")) patch.role = role;
          if (organization) patch.organization = organization;
          await supabase
            .from("profiles")
            .update(patch)
            .eq("id", user.id);
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const admin = createAdminClient();
        await admin.rpc("record_profile_login", { target_user_id: user.id });
      }

      return NextResponse.redirect(`${redirectOrigin}${next}`);
    }
  }

  return NextResponse.redirect(`${redirectOrigin}/login?error=oauth`);
}
