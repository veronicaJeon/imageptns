import { NextResponse } from "next/server";
import {
  getCanonicalRedirectOrigin,
  getSafeRelativePath,
} from "@/lib/routing/canonical";
import { PHOTOGRAPHER_APPLICATION_COMPLETE_PATH } from "@/lib/auth/auth-feedback";
import { photographerIntentCreatesBuyerRole } from "@/lib/auth/signup-flow";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const role = searchParams.get("role"); // "buyer" | "photographer" — passed via redirectTo
  const next = getSafeRelativePath(searchParams.get("next"), "/dashboard");
  const redirectOrigin = getCanonicalRedirectOrigin(origin);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const admin = createAdminClient();
        const selectedRole = role === "buyer" || role === "photographer" ? role : null;
        const signupIntent = photographerIntentCreatesBuyerRole(selectedRole);

        if (selectedRole) {
          await supabase.auth.updateUser({
            data: { role: selectedRole, requested_role: selectedRole },
          });
        }

        await admin.rpc("record_profile_login", { target_user_id: user.id });

        // Google signups never carry contact details in the URL. Photographers
        // finish the application (phone, regions, bio) on the settings page.
        if (signupIntent.shouldCreateApplication) {
          return NextResponse.redirect(`${redirectOrigin}${PHOTOGRAPHER_APPLICATION_COMPLETE_PATH}`);
        }
      }

      return NextResponse.redirect(`${redirectOrigin}${next}`);
    }
  }

  return NextResponse.redirect(`${redirectOrigin}/login?error=oauth`);
}
