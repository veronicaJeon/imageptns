import { NextResponse } from "next/server";
import {
  getCanonicalRedirectOrigin,
  getSafeRelativePath,
} from "@/lib/routing/canonical";
import { photographerIntentCreatesBuyerRole } from "@/lib/auth/signup-flow";
import {
  buildPhotographerApplicationPayload,
  ensurePendingPhotographerApplication,
} from "@/lib/photographers/approval";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const role = searchParams.get("role"); // "buyer" | "photographer" — passed via redirectTo
  const organization = searchParams.get("organization")?.trim().replace(/\s+/g, " ") ?? "";
  const phoneNumber = searchParams.get("phone_number")?.trim().replace(/\s+/g, " ") ?? "";
  const primaryActivityRegions = searchParams.get("primary_activity_regions") ?? "";
  const bio = searchParams.get("bio")?.trim() ?? "";
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
        const metadataPatch: Record<string, string> = {};

        if (selectedRole) {
          metadataPatch.role = selectedRole;
          metadataPatch.requested_role = selectedRole;
        }
        if (organization) metadataPatch.organization = organization;
        if (phoneNumber) metadataPatch.phone_number = phoneNumber;
        if (primaryActivityRegions) metadataPatch.primary_activity_regions = primaryActivityRegions;
        if (bio) metadataPatch.bio = bio;

        if (Object.keys(metadataPatch).length > 0) {
          await supabase.auth.updateUser({ data: metadataPatch });
        }

        if (organization) {
          const { error: profileUpdateError } = await admin
            .from("profiles")
            .update({ organization, updated_at: new Date().toISOString() })
            .eq("id", user.id);

          if (profileUpdateError) {
            console.error("[auth-callback] profile organization update failed", profileUpdateError);
          }
        }

        if (signupIntent.shouldCreateApplication) {
          const userMetadata = user.user_metadata as Record<string, unknown>;
          const name =
            (typeof userMetadata.full_name === "string" && userMetadata.full_name.trim()) ||
            (typeof userMetadata.name === "string" && userMetadata.name.trim()) ||
            user.email?.split("@")[0] ||
            "Google User";

          try {
            const applicationPayload = buildPhotographerApplicationPayload({
              profileId: user.id,
              name,
              organization,
              phoneNumber,
              primaryActivityRegions,
              bio,
            });

            if (!applicationPayload.phone_number || applicationPayload.primary_activity_regions.length === 0) {
              return NextResponse.redirect(
                `${redirectOrigin}/dashboard/settings?photographer_application=missing_info`
              );
            }

            await ensurePendingPhotographerApplication(admin, {
              profileId: user.id,
              name,
              organization,
              phoneNumber,
              primaryActivityRegions,
              bio,
            });
          } catch (applicationError) {
            console.error("[auth-callback] photographer application creation failed", applicationError);
            return NextResponse.redirect(`${redirectOrigin}/dashboard/settings?photographer_application=failed`);
          }
        }

        await admin.rpc("record_profile_login", { target_user_id: user.id });
      }

      return NextResponse.redirect(`${redirectOrigin}${next}`);
    }
  }

  return NextResponse.redirect(`${redirectOrigin}/login?error=oauth`);
}
