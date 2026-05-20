import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPayoutApproved, sendPayoutRejected } from "@/lib/email/resend";

interface PayoutNotificationRow {
  period: string;
  total_net_krw: number;
  photographer_id: string;
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  return profile?.is_admin ? user : null;
}

export async function GET(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const status = req.nextUrl.searchParams.get("status");
  const admin = createAdminClient();

  let query = admin
    .from("payouts")
    .select(
      `
      id, period, total_gross_krw, total_commission, total_net_krw,
      status, payout_method, note, created_at, paid_at,
      photographer:profiles!photographer_id(id, full_name, email)
    `
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ payouts: data ?? [] });
}

interface ActionBody {
  payout_id: string;
  action: "approve" | "reject";
  note?: string;
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body: ActionBody = await req.json();
  const { payout_id, action, note } = body;

  if (!payout_id || !action) {
    return NextResponse.json({ error: "payout_id and action are required" }, { status: 400 });
  }
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify payout exists
  const { data: existing, error: fetchError } = await admin
    .from("payouts")
    .select("id, status")
    .eq("id", payout_id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Payout not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> =
    action === "approve"
      ? { status: "paid", paid_at: new Date().toISOString(), note: note ?? null }
      : { status: "rejected", note: note ?? null };

  const { data: payout, error: updateError } = await admin
    .from("payouts")
    .update(updates)
    .eq("id", payout_id)
    .select()
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Fire-and-forget payout notification email
  if (existing) {
    (async () => {
      const { data: payoutFullData } = await admin
        .from("payouts")
        .select("period, total_net_krw, photographer_id")
        .eq("id", payout_id)
        .single();
      const payoutFull = payoutFullData as PayoutNotificationRow | null;
      if (!payoutFull) return;

      const [profileRes, authRes] = await Promise.all([
        admin.from("profiles").select("full_name").eq("id", payoutFull.photographer_id).single(),
        admin.auth.admin.getUserById(payoutFull.photographer_id),
      ]);
      const email = authRes.data.user?.email;
      const name  = profileRes.data?.full_name ?? "사진작가";
      if (!email) return;

      if (action === "approve") {
        await sendPayoutApproved({ photographerEmail: email, photographerName: name, period: payoutFull.period, netKrw: payoutFull.total_net_krw });
      } else {
        await sendPayoutRejected({ photographerEmail: email, photographerName: name, period: payoutFull.period, netKrw: payoutFull.total_net_krw, note: note });
      }
    })().catch(console.error);
  }

  return NextResponse.json({ payout });
}
