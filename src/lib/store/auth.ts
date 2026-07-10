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

interface AuthStore {
  user: AuthUser | null;
  loading: boolean;
  init: () => Promise<void>;
  signOut: () => Promise<void>;
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

      set({
        user: {
          id: user.id,
          email: user.email ?? "",
          full_name: profile?.full_name ?? "",
          organization: profile?.organization ?? null,
          role: (profile?.role as "buyer" | "photographer") ?? "buyer",
          roles: Array.isArray(profile?.roles) ? profile.roles as Array<"buyer" | "photographer"> : [(profile?.role as "buyer" | "photographer") ?? "buyer"],
          photographer_status:
            profile?.photographer_status === "pending" ||
            profile?.photographer_status === "approved" ||
            profile?.photographer_status === "suspended"
              ? profile.photographer_status
              : "none",
          avatar_url: profile?.avatar_url ?? null,
          is_admin: profile?.is_admin ?? false,
        },
        loading: false,
      });

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

        set({
          user: {
            id: session.user.id,
            email: session.user.email ?? "",
            full_name: p?.full_name ?? "",
            organization: p?.organization ?? null,
            role: (p?.role as "buyer" | "photographer") ?? "buyer",
            roles: Array.isArray(p?.roles) ? p.roles as Array<"buyer" | "photographer"> : [(p?.role as "buyer" | "photographer") ?? "buyer"],
            photographer_status:
              p?.photographer_status === "pending" ||
              p?.photographer_status === "approved" ||
              p?.photographer_status === "suspended"
                ? p.photographer_status
                : "none",
            avatar_url: p?.avatar_url ?? null,
            is_admin: p?.is_admin ?? false,
          },
          loading: false,
        });
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
