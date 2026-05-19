import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/security/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { nextPeriodEnd, subscriptionAmount } from "@/lib/subscription/plans";

export const maxDuration = 60;

const TOSS_BASE = "https://api.tosspayments.com/v1";

interface SubscriptionRow {
  id: string;
  user_id: string;
  plan: string;
  billing_key: string | null;
  customer_key: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  billing_cycle: string | null;
}

function tossAuthHeader() {
  const secret = process.env.TOSS_SECRET_KEY ?? "";
  return "Basic " + Buffer.from(secret + ":").toString("base64");
}

export async function GET(request: Request) {
  const cronAuthorization = authorizeCronRequest(request.headers);
  if (!cronAuthorization.authorized) {
    return NextResponse.json({ error: cronAuthorization.error }, { status: cronAuthorization.status });
  }
  if (!process.env.TOSS_SECRET_KEY) {
    return NextResponse.json({ error: "Toss secret key is not configured" }, { status: 503 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const { data, error } = await admin
    .from("subscriptions")
    .select("id, user_id, plan, billing_key, customer_key, current_period_end, cancel_at_period_end, billing_cycle")
    .eq("status", "active")
    .lte("current_period_end", now.toISOString())
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as SubscriptionRow[];
  let renewed = 0;
  let cancelled = 0;
  let failed = 0;

  for (const subscription of rows) {
    if (subscription.cancel_at_period_end) {
      const { error: cancelError } = await admin
        .from("subscriptions")
        .update({ status: "cancelled" })
        .eq("id", subscription.id)
        .eq("status", "active");
      if (cancelError) failed++;
      else cancelled++;
      continue;
    }

    if (!subscription.billing_key || !subscription.customer_key) {
      await admin.from("subscription_payments").insert({
        subscription_id: subscription.id,
        user_id: subscription.user_id,
        status: "failed",
        error_message: "Missing billing key or customer key",
      });
      failed++;
      continue;
    }

    const annual = subscription.billing_cycle === "annual";
    const amount = subscriptionAmount(subscription.plan, annual);
    if (!amount) {
      await admin.from("subscription_payments").insert({
        subscription_id: subscription.id,
        user_id: subscription.user_id,
        status: "failed",
        error_message: `Invalid plan: ${subscription.plan}`,
      });
      failed++;
      continue;
    }

    const orderId = randomUUID();
    const chargeRes = await fetch(`${TOSS_BASE}/billing/${encodeURIComponent(subscription.billing_key)}`, {
      method: "POST",
      headers: {
        Authorization: tossAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerKey: subscription.customer_key,
        amount,
        orderId,
        orderName: `이미지파트너스 ${subscription.plan} 플랜 갱신`,
      }),
    });

    if (!chargeRes.ok) {
      const body = await chargeRes.json().catch(() => ({})) as { message?: string };
      await admin.from("subscription_payments").insert({
        subscription_id: subscription.id,
        user_id: subscription.user_id,
        toss_order_id: orderId,
        amount_krw: amount,
        status: "failed",
        error_message: body.message ?? "Subscription renewal failed",
      });
      failed++;
      continue;
    }

    const periodStart = subscription.current_period_end ? new Date(subscription.current_period_end) : now;
    const periodEnd = nextPeriodEnd(periodStart, annual);
    await admin.from("subscription_payments").insert({
      subscription_id: subscription.id,
      user_id: subscription.user_id,
      toss_order_id: orderId,
      amount_krw: amount,
      status: "paid",
      paid_at: now.toISOString(),
    });

    const { error: updateError } = await admin
      .from("subscriptions")
      .update({
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        toss_order_id: orderId,
      })
      .eq("id", subscription.id)
      .eq("status", "active");

    if (updateError) failed++;
    else renewed++;
  }

  return NextResponse.json({ checked: rows.length, renewed, cancelled, failed });
}
