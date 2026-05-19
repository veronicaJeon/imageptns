import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const paymentKey = searchParams.get("paymentKey");
  const orderId    = searchParams.get("orderId");   // toss_order_id
  const amount     = Number(searchParams.get("amount"));

  if (!paymentKey || !orderId || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.redirect(
      new URL("/checkout/fail?code=MISSING_PARAMS", req.url)
    );
  }

  const admin = createAdminClient();
  const { data: existingOrder, error: orderLoadError } = await admin
    .from("orders")
    .select("id, order_number, total_krw, status, toss_payment_key")
    .eq("toss_order_id", orderId)
    .eq("payment_provider", "toss")
    .single();

  if (orderLoadError || !existingOrder) {
    return NextResponse.redirect(new URL("/checkout/fail?code=ORDER_NOT_FOUND", req.url));
  }

  if (Number(existingOrder.total_krw) !== amount) {
    return NextResponse.redirect(new URL("/checkout/fail?code=AMOUNT_MISMATCH", req.url));
  }

  if (existingOrder.status === "completed") {
    return NextResponse.redirect(
      new URL(`/checkout/success?order=${existingOrder.order_number ?? ""}`, req.url)
    );
  }

  if (existingOrder.status !== "pending") {
    return NextResponse.redirect(new URL("/checkout/fail?code=ORDER_NOT_PENDING", req.url));
  }

  // Confirm with Toss Payments API
  const tossRes = await fetch(
    "https://api.tosspayments.com/v1/payments/confirm",
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(process.env.TOSS_SECRET_KEY + ":").toString("base64"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    }
  );

  const tossData = await tossRes.json();

  if (!tossRes.ok) {
    // Mark order failed
    await admin
      .from("orders")
      .update({ status: "failed" })
      .eq("toss_order_id", orderId);

    const code = tossData.code ?? "TOSS_ERROR";
    return NextResponse.redirect(
      new URL(`/checkout/fail?code=${code}`, req.url)
    );
  }

  // Mark order completed — triggers earnings_ledger + downloads via DB trigger
  const { data: order } = await admin
    .from("orders")
    .update({
      status:           "completed",
      toss_payment_key: paymentKey,
      completed_at:     new Date().toISOString(),
    })
    .eq("toss_order_id", orderId)
    .eq("status", "pending")
    .eq("total_krw", amount)
    .select("id, order_number")
    .maybeSingle();

  if (!order) {
    return NextResponse.redirect(new URL("/checkout/fail?code=ORDER_UPDATE_FAILED", req.url));
  }

  return NextResponse.redirect(
    new URL(`/checkout/success?order=${order?.order_number ?? ""}`, req.url)
  );
}
