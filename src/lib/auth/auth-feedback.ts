import type { SignupRole } from "./signup-flow";

export type LoginQueryNotice = "oauth" | "confirmation_link" | "recovery_link";

export const PHOTOGRAPHER_APPLICATION_COMPLETE_PATH =
  "/dashboard/settings?photographer_application=complete_info";

// Older links and the legacy /auth/callback route still use the first two codes.
export function loginQueryNotice(value: string | null): LoginQueryNotice | null {
  if (value === "oauth") return "oauth";
  if (value === "confirmation_link" || value === "auth_confirmation" || value === "auth_callback_failed") {
    return "confirmation_link";
  }
  if (value === "recovery_link") return "recovery_link";
  return null;
}

export function confirmationFailureQuery(type: string | null): "confirmation_link" | "recovery_link" {
  return type === "recovery" ? "recovery_link" : "confirmation_link";
}

export function isEmailNotConfirmedError(error: { code?: string | null; message?: string | null } | null) {
  if (!error) return false;
  if (error.code === "email_not_confirmed") return true;
  return /email not confirmed/i.test(error.message ?? "");
}

// Only the role travels through OAuth redirects. Contact details, regions and bio
// are personal data and must not appear in URLs, so photographers enter them on
// the settings page after Google sign-in.
export function buildGoogleSignupPath(role: SignupRole) {
  const params = new URLSearchParams({ next: "/dashboard", role });
  return `/api/auth/google?${params.toString()}`;
}
