import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  getCanonicalRedirectOrigin,
  getSafeRelativePath,
} from "@/lib/routing/canonical";
import { createClient } from "@/lib/supabase/server";

const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  "email",
  "signup",
  "recovery",
  "invite",
  "magiclink",
  "email_change",
]);

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const requestedType = searchParams.get("type");
  const next = getSafeRelativePath(searchParams.get("next"), "/dashboard");
  const redirectOrigin = getCanonicalRedirectOrigin(origin);

  if (tokenHash && requestedType && EMAIL_OTP_TYPES.has(requestedType as EmailOtpType)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: requestedType as EmailOtpType,
    });

    if (!error) {
      return NextResponse.redirect(`${redirectOrigin}${next}`);
    }

    console.error("[auth-confirm] OTP verification failed", {
      name: error.name,
      message: error.message,
      status: error.status,
      code: error.code,
      type: requestedType,
    });
  }

  return NextResponse.redirect(`${redirectOrigin}/login?error=auth_confirmation`);
}
