import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendImageApproved, sendImageRejected } from "@/lib/email/resend";

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
    .select("id, status, rejection_reason, approved_at, title, asset_id, photographer_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fire-and-forget notification — never block the response
  if (data.photographer_id) {
    (async () => {
      const [profileRes, authRes] = await Promise.all([
        admin.from("profiles").select("full_name").eq("id", data.photographer_id).single(),
        admin.auth.admin.getUserById(data.photographer_id),
      ]);
      const email = authRes.data.user?.email;
      const name  = profileRes.data?.full_name ?? "사진작가";
      if (!email) return;

      if (action === "approve") {
        await sendImageApproved({ photographerEmail: email, photographerName: name, imageTitle: data.title, assetId: data.asset_id });
      } else {
        await sendImageRejected({ photographerEmail: email, photographerName: name, imageTitle: data.title, assetId: data.asset_id, reason: rejection_reason! });
      }
    })().catch(console.error);
  }

  return NextResponse.json({ image: data });
}
