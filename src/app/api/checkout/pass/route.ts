import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// TEMPORARY: Toss 유료결제 우회(결제 pass). NEXT_PUBLIC_PAYMENT_PASS_ENABLED=true 일 때만 동작.
// 실제 Toss 유료결제 연동이 완료되면 이 라우트와 호출부, env를 함께 제거할 것.
export function isPaymentPassEnabled() {
  return process.env.NEXT_PUBLIC_PAYMENT_PASS_ENABLED === "true";
}

export async function POST(req: NextRequest) {
  if (!isPaymentPassEnabled()) {
    return NextResponse.json({ error: "Payment pass is disabled" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderDbId }: { orderDbId?: string } = await req.json().catch(() => ({}));
  if (!orderDbId) return NextResponse.json({ error: "orderDbId is required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: order, error: loadError } = await admin
    .from("orders")
    .select("id, order_number, buyer_id, status, payment_provider, total_krw")
    .eq("id", orderDbId)
    .single();

  if (loadError || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.buyer_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (order.payment_provider !== "toss") {
    return NextResponse.json({ error: "Only Toss orders can be passed" }, { status: 400 });
  }
  if (order.status === "completed") {
    return NextResponse.json({ orderNumber: order.order_number, alreadyCompleted: true });
  }
  if (order.status !== "pending") {
    return NextResponse.json({ error: "Order is not pending" }, { status: 409 });
  }

  // Complete without payment. The order-completion DB trigger creates downloads + earnings_ledger,
  // so the full post-purchase flow stays testable. Marked with a PASS_ key for auditability.
  const { data: completed, error: completeError } = await admin
    .from("orders")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      toss_payment_key: `PASS_${order.id}`,
    })
    .eq("id", order.id)
    .eq("status", "pending")
    .select("id, order_number")
    .maybeSingle();

  if (completeError || !completed) {
    return NextResponse.json({ error: completeError?.message ?? "Order update failed" }, { status: 500 });
  }

  return NextResponse.json({ orderNumber: completed.order_number, passed: true });
}
