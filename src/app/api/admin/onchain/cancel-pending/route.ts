import { NextRequest, NextResponse } from "next/server";
import { canCancelPendingOnchainOrder } from "@/lib/onchain/reconciliation";
import { recordAdminAuditLog } from "@/lib/admin/audit";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface CancelBody {
  orderId?: string;
  reason?: string;
}

async function requireAdmin(admin: ReturnType<typeof createAdminClient>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  return profile?.is_admin ? user : null;
}

export async function POST(req: NextRequest) {
  const admin = createAdminClient();
  const user = await requireAdmin(admin);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { orderId, reason }: CancelBody = await req.json().catch(() => ({}));
  if (!orderId) return NextResponse.json({ error: "orderId is required" }, { status: 400 });

  const { data: order, error: loadError } = await admin
    .from("orders")
    .select("id, order_number, payment_provider, status, crypto_status, payment_tx_hash")
    .eq("id", orderId)
    .single();

  if (loadError || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const decision = canCancelPendingOnchainOrder({
    paymentProvider: order.payment_provider,
    status: order.status,
    cryptoStatus: order.crypto_status,
    paymentTxHash: order.payment_tx_hash,
  });
  if (!decision.allowed) {
    return NextResponse.json({ error: decision.reason }, { status: 409 });
  }

  // Conditional update guards against a tx landing between read and write.
  const { data: canceled, error: updateError } = await admin
    .from("orders")
    .update({ status: "canceled", crypto_status: "canceled" })
    .eq("id", order.id)
    .eq("status", "pending")
    .eq("crypto_status", "pending")
    .is("payment_tx_hash", null)
    .select("id, order_number")
    .maybeSingle();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  if (!canceled) {
    return NextResponse.json({ error: "주문 상태가 변경되어 취소할 수 없습니다." }, { status: 409 });
  }

  await recordAdminAuditLog(admin, {
    actorId: user.id,
    action: "onchain_order_cancel",
    targetType: "order",
    targetId: order.id,
    targetLabel: order.order_number ?? order.id,
    before: { status: order.status, crypto_status: order.crypto_status },
    after: { status: "canceled", crypto_status: "canceled" },
    reason: reason ?? null,
    metadata: { paymentProvider: order.payment_provider },
  });

  return NextResponse.json({ ok: true, orderNumber: canceled.order_number });
}
