import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const role = searchParams.get("role"); // "buyer" | "photographer" — passed via redirectTo
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // For Google OAuth with a selected role: update both user metadata AND profiles table.
      // The DB trigger already ran at user-creation time (before the callback),
      // so we must update the profile row directly to save the correct role.
      if (role && (role === "buyer" || role === "photographer")) {
        await supabase.auth.updateUser({ data: { role } });

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from("profiles")
            .update({ role })
            .eq("id", user.id);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
