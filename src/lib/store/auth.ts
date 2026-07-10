import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  organization: string | null;
  role: "buyer" | "photographer";
  roles: Array<"buyer" | "photographer">;
  photographer_status: "none" | "pending" | "approved" | "suspended";
  avatar_url: string | null;
  is_admin: boolean;
}

type ProfileRole = AuthUser["role"];
type PhotographerStatus = AuthUser["photographer_status"];
type ProfileRow = {
  full_name?: string | null;
  organization?: string | null;
  role?: string | null;
  roles?: unknown;
  photographer_status?: string | null;
  avatar_url?: string | null;
  is_admin?: boolean | null;
};

interface AuthStore {
  user: AuthUser | null;
  loading: boolean;
  init: () => Promise<void>;
  signOut: () => Promise<void>;
}

function normalizePhotographerStatus(value: unknown): PhotographerStatus {
  return value === "pending" || value === "approved" || value === "suspended" ? value : "none";
}

function normalizeProfileRole(value: unknown): ProfileRole {
  return value === "photographer" ? "photographer" : "buyer";
}

function normalizeProfileRoles(profile: ProfileRow | null | undefined, status: PhotographerStatus) {
  const fallbackRole = normalizeProfileRole(profile?.role);
  const rawRoles = Array.isArray(profile?.roles)
    ? profile.roles.filter((role): role is ProfileRole => role === "buyer" || role === "photographer")
    : [fallbackRole];
  const roles = rawRoles.length > 0 ? rawRoles : [fallbackRole];

  if (status !== "approved") {
    return Array.from(new Set(roles));
  }

  return Array.from(new Set<ProfileRole>(["buyer", ...roles, "photographer"]));
}

function buildAuthUser(user: { id: string; email?: string | null }, profile: ProfileRow | null | undefined): AuthUser {
  const photographerStatus = normalizePhotographerStatus(profile?.photographer_status);
  const role = photographerStatus === "approved" ? "photographer" : normalizeProfileRole(profile?.role);

  return {
    id: user.id,
    email: user.email ?? "",
    full_name: profile?.full_name ?? "",
    organization: profile?.organization ?? null,
    role,
    roles: normalizeProfileRoles(profile, photographerStatus),
    photographer_status: photographerStatus,
    avatar_url: profile?.avatar_url ?? null,
    is_admin: profile?.is_admin ?? false,
  };
}

export const useAuth = create<AuthStore>((set) => ({
  user: null,
  loading: true,

  init: async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        set({ user: null, loading: false });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, organization, role, roles, photographer_status, avatar_url, is_admin")
        .eq("id", user.id)
        .single();

      set({ user: buildAuthUser(user, profile), loading: false });

      // Listen for auth state changes
      supabase.auth.onAuthStateChange(async (_event, session) => {
        if (!session?.user) {
          set({ user: null, loading: false });
          return;
        }
        const { data: p } = await supabase
          .from("profiles")
          .select("full_name, organization, role, roles, photographer_status, avatar_url, is_admin")
          .eq("id", session.user.id)
          .single();

        set({ user: buildAuthUser(session.user, p), loading: false });
      });
    } catch {
      // Supabase env vars missing or network error — show logged-out UI
      set({ user: null, loading: false });
    }
  },

  signOut: async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    set({ user: null });
    window.location.href = "/login";
  },
}));
