import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: "buyer" | "photographer";
  avatar_url: string | null;
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
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      set({ user: null, loading: false });
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role, avatar_url")
      .eq("id", user.id)
      .single();

    set({
      user: {
        id: user.id,
        email: user.email ?? "",
        full_name: profile?.full_name ?? "",
        role: (profile?.role as "buyer" | "photographer") ?? "buyer",
        avatar_url: profile?.avatar_url ?? null,
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
        .select("full_name, role, avatar_url")
        .eq("id", session.user.id)
        .single();

      set({
        user: {
          id: session.user.id,
          email: session.user.email ?? "",
          full_name: p?.full_name ?? "",
          role: (p?.role as "buyer" | "photographer") ?? "buyer",
          avatar_url: p?.avatar_url ?? null,
        },
        loading: false,
      });
    });
  },

  signOut: async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    set({ user: null });
    window.location.href = "/login";
  },
}));
