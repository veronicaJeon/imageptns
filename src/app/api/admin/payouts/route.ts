import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPayoutApproved, sendPayoutRejected } from "@/lib/email/resend";
import { recordAdminAuditLog } from "@/lib/admin/audit";
import {
  PAYOUT_ACTIONABLE_STATUSES,
  type PayoutAction,
  isPayoutAction,
  isPayoutActionable,
  normalizePayoutNote,
  payoutActionUpdates,
  payoutAuditAction,
} from "@/lib/admin/payouts";

interface PayoutRow {
  id: string;
  status: string;
  note: string | null;
  paid_at: string | null;
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

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const payoutId = typeof body.payout_id === "string" ? body.payout_id : "";
  const action = body.action;
  const note = normalizePayoutNote(body.note);

  if (!payoutId || !action) {
    return NextResponse.json({ error: "payout_id and action are required" }, { status: 400 });
  }
  if (!isPayoutAction(action)) {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: existingData, error: fetchError } = await admin
    .from("payouts")
    .select("id, status, note, paid_at, period, total_net_krw, photographer_id")
    .eq("id", payoutId)
    .single();
  const existing = existingData as PayoutRow | null;

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Payout not found" }, { status: 404 });
  }
  if (!isPayoutActionable(existing.status)) {
    return NextResponse.json({ error: "이미 처리된 정산 요청입니다. 목록을 새로고침해 주세요." }, { status: 409 });
  }

  // 상태 조건부 갱신: 동시에 두 번 눌러도 한 번만 처리된다.
  const { data: payout, error: updateError } = await admin
    .from("payouts")
    .update(payoutActionUpdates(action, note, new Date()))
    .eq("id", payoutId)
    .in("status", [...PAYOUT_ACTIONABLE_STATUSES])
    .select()
    .maybeSingle();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  if (!payout) {
    return NextResponse.json({ error: "이미 처리된 정산 요청입니다. 목록을 새로고침해 주세요." }, { status: 409 });
  }

  const email = await notifyPhotographer(admin, existing, action, note);

  await recordAdminAuditLog(admin, {
    actorId: user.id,
    action: payoutAuditAction(action),
    targetType: "payout",
    targetId: payoutId,
    targetLabel: existing.period,
    before: { status: existing.status, note: existing.note, paid_at: existing.paid_at },
    after: { status: payout.status, note: payout.note, paid_at: payout.paid_at },
    reason: note,
    metadata: { total_net_krw: existing.total_net_krw, photographer_id: existing.photographer_id, email },
  });

  return NextResponse.json({ payout, email });
}

type NotificationResult = "sent" | "failed" | "skipped";

async function notifyPhotographer(
  admin: ReturnType<typeof createAdminClient>,
  payout: PayoutRow,
  action: PayoutAction,
  note: string | null,
): Promise<NotificationResult> {
  try {
    const [profileRes, authRes] = await Promise.all([
      admin.from("profiles").select("full_name").eq("id", payout.photographer_id).single(),
      admin.auth.admin.getUserById(payout.photographer_id),
    ]);
    const email = authRes.data.user?.email;
    if (!email) return "skipped";
    const name = profileRes.data?.full_name ?? "사진작가";
    const message = {
      photographerEmail: email,
      photographerName: name,
      period: payout.period,
      netKrw: payout.total_net_krw,
    };

    if (action === "approve") await sendPayoutApproved(message);
    else await sendPayoutRejected({ ...message, note: note ?? undefined });
    return "sent";
  } catch (error) {
    console.error("[admin/payouts] notification failed", { payoutId: payout.id, error });
    return "failed";
  }
}
