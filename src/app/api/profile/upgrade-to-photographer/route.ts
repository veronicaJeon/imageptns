import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check current explicit roles. Upgrading adds photographer rights without
  // removing buyer rights.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, roles")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  const currentRoles = Array.isArray(profile.roles) ? profile.roles as string[] : [profile.role ?? "buyer"];
  if (currentRoles.includes("photographer")) {
    return NextResponse.json({ error: "Already a photographer" }, { status: 400 });
  }

  // Use admin client to bypass RLS (profiles update policy restricts role changes)
  const admin = createAdminClient();
  const roles = Array.from(new Set([...currentRoles, "buyer", "photographer"]));
  const { data: updated, error } = await admin
    .from("profiles")
    .update({ role: "photographer", roles, updated_at: new Date().toISOString() })
    .eq("id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: updated });
}
