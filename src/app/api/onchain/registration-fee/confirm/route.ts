import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordOnchainEvent } from "@/lib/onchain/events";
import { isOnchainEnabled } from "@/lib/onchain/env";

function redirectTo(req: NextRequest, params: Record<string, string>) {
  const url = new URL("/dashboard/blockchain", req.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  if (!isOnchainEnabled()) {
    return NextResponse.json({ error: "Onchain features are disabled" }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const paymentKey = searchParams.get("paymentKey");
  const orderId = searchParams.get("orderId"); // toss_order_id
  const amount = Number(searchParams.get("amount"));

  if (!paymentKey || !orderId || !Number.isFinite(amount) || amount <= 0) {
    return redirectTo(req, { fee: "fail", code: "MISSING_PARAMS" });
  }

  const admin = createAdminClient();
  const { data: order, error: orderError } = await admin
    .from("arweave_registration_fee_orders")
    .select("id, photographer_id, amount_krw, status")
    .eq("toss_order_id", orderId)
    .single();

  if (orderError || !order) return redirectTo(req, { fee: "fail", code: "ORDER_NOT_FOUND" });
  if (Number(order.amount_krw) !== amount) return redirectTo(req, { fee: "fail", code: "AMOUNT_MISMATCH" });
  if (order.status === "paid") return redirectTo(req, { fee: "success" });
  if (order.status !== "pending") return redirectTo(req, { fee: "fail", code: "ORDER_NOT_PENDING" });

  const { data: photographerProfile } = await admin
    .from("profiles")
    .select("photographer_status")
    .eq("id", order.photographer_id)
    .maybeSingle();

  if (photographerProfile?.photographer_status !== "approved") {
    return redirectTo(req, { fee: "fail", code: "PHOTOGRAPHER_APPROVAL_REQUIRED" });
  }

  const tossRes = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(process.env.TOSS_SECRET_KEY + ":").toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });
  const tossData = await tossRes.json().catch(() => ({}));

  if (!tossRes.ok) {
    await admin
      .from("arweave_registration_fee_orders")
      .update({ status: "failed" })
      .eq("toss_order_id", orderId)
      .eq("status", "pending");
    return redirectTo(req, { fee: "fail", code: tossData?.code ?? "TOSS_ERROR" });
  }

  const paidAt = new Date().toISOString();
  const { data: paidOrder } = await admin
    .from("arweave_registration_fee_orders")
    .update({ status: "paid", toss_payment_key: paymentKey, paid_at: paidAt })
    .eq("toss_order_id", orderId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (!paidOrder) return redirectTo(req, { fee: "fail", code: "ORDER_UPDATE_FAILED" });

  const { data: items } = await admin
    .from("arweave_registration_fee_order_items")
    .select("image_id")
    .eq("fee_order_id", order.id);
  const imageIds = ((items ?? []) as { image_id: string }[]).map((item) => item.image_id);

  if (imageIds.length > 0) {
    await admin
      .from("images")
      .update({
        proof_status: "requested",
        proof_requested_at: paidAt,
        proof_requested_by: order.photographer_id,
        proof_request_payment_status: "paid",
        proof_failure_reason: null,
      })
      .in("id", imageIds)
      .eq("proof_request_fee_order_id", order.id);

    await Promise.all(
      imageIds.map((imageId) =>
        recordOnchainEvent(admin, {
          eventType: "proof_self_funded_fee_paid",
          actorId: order.photographer_id,
          imageId,
          metadata: { feeOrderId: order.id, paymentKey, amount },
        }),
      ),
    );
  }

  return redirectTo(req, { fee: "success" });
}
