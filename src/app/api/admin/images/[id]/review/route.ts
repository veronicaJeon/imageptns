import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  return profile?.is_admin ? user : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { action, rejection_reason } = body as {
    action: "approve" | "reject";
    rejection_reason?: string;
  };

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });
  }
  if (action === "reject" && !rejection_reason?.trim()) {
    return NextResponse.json({ error: "rejection_reason required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const update =
    action === "approve"
      ? { status: "approved", approved_at: new Date().toISOString(), rejection_reason: null }
      : { status: "rejected", rejection_reason: rejection_reason!.trim(), approved_at: null };

  const { data, error } = await admin
    .from("images")
    .update(update)
    .eq("id", id)
    .select("id, status, rejection_reason, approved_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ image: data });
}
