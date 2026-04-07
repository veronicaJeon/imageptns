import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const paymentKey = searchParams.get("paymentKey");
  const orderId    = searchParams.get("orderId");   // toss_order_id
  const amount     = Number(searchParams.get("amount"));

  if (!paymentKey || !orderId || !amount) {
    return NextResponse.redirect(
      new URL("/checkout/fail?code=MISSING_PARAMS", req.url)
    );
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

  const supabase = await createClient();

  if (!tossRes.ok) {
    // Mark order failed
    await supabase
      .from("orders")
      .update({ status: "failed" })
      .eq("toss_order_id", orderId);

    const code = tossData.code ?? "TOSS_ERROR";
    return NextResponse.redirect(
      new URL(`/checkout/fail?code=${code}`, req.url)
    );
  }

  // Mark order completed — triggers earnings_ledger + downloads via DB trigger
  const { data: order } = await supabase
    .from("orders")
    .update({
      status:           "completed",
      toss_payment_key: paymentKey,
      completed_at:     new Date().toISOString(),
    })
    .eq("toss_order_id", orderId)
    .select("id, order_number")
    .single();

  return NextResponse.redirect(
    new URL(`/checkout/success?order=${order?.order_number ?? ""}`, req.url)
  );
}
