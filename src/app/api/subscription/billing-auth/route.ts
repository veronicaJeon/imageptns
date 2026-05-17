import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomUUID } from "crypto";

const TOSS_BASE = "https://api.tosspayments.com/v1";

function tossAuthHeader() {
  const secret = process.env.TOSS_SECRET_KEY ?? "";
  // Basic base64(secretKey:)
  return "Basic " + Buffer.from(secret + ":").toString("base64");
}

const PLAN_PRICES: Record<string, number> = {
  basic:      29000,
  pro:        79000,
  enterprise: 199000,
};

const PLAN_PRICES_ANNUAL: Record<string, number> = {
  basic:      23200,
  pro:        63200,
  enterprise: 159200,
};

/**
 * POST /api/subscription/billing-auth
 *
 * body: { customerKey: string; authKey: string; plan: string; annual?: boolean }
 *
 * 흐름:
 *  1. Toss 빌링키 발급 (authorizations/issue)
 *  2. 즉시 첫 결제 실행 (billing/{billingKey})
 *  3. subscriptions 테이블에 저장
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as {
    customerKey: string;
    authKey: string;
    plan: string;
    annual?: boolean;
  };

  const { customerKey, authKey, plan, annual = false } = body;

  if (!customerKey || !authKey || !plan) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!PLAN_PRICES[plan]) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  // ── 1. 빌링키 발급 ──────────────────────────────────────────
  const issueRes = await fetch(`${TOSS_BASE}/billing/authorizations/issue`, {
    method: "POST",
    headers: {
      Authorization: tossAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ customerKey, authKey }),
  });

  if (!issueRes.ok) {
    const err = await issueRes.json().catch(() => ({}));
    console.error("[billing-auth] issue error", err);
    return NextResponse.json(
      { error: (err as { message?: string }).message ?? "빌링키 발급 실패" },
      { status: issueRes.status }
    );
  }

  const { billingKey, cardCompany, cardNumber } = await issueRes.json() as {
    billingKey: string;
    cardCompany: string;
    cardNumber: string;
  };

  // ── 2. 즉시 첫 결제 실행 ──────────────────────────────────────
  const amount = annual ? PLAN_PRICES_ANNUAL[plan] : PLAN_PRICES[plan];
  const orderId = randomUUID();
  const orderName = `이미지파트너스 ${plan.charAt(0).toUpperCase() + plan.slice(1)} 플랜 (${annual ? "연간" : "월간"})`;

  const chargeRes = await fetch(`${TOSS_BASE}/billing/${encodeURIComponent(billingKey)}`, {
    method: "POST",
    headers: {
      Authorization: tossAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customerKey,
      amount,
      orderId,
      orderName,
      customerEmail: user.email,
      customerName:  user.user_metadata?.full_name ?? user.email,
    }),
  });

  if (!chargeRes.ok) {
    const err = await chargeRes.json().catch(() => ({}));
    console.error("[billing-auth] charge error", err);
    return NextResponse.json(
      { error: (err as { message?: string }).message ?? "첫 결제 실패" },
      { status: chargeRes.status }
    );
  }

  // ── 3. subscriptions 저장 ────────────────────────────────────
  const now = new Date();
  const periodEnd = new Date(now);
  if (annual) {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  // 기존 활성 구독이 있으면 만료 처리
  const adminSb = createAdminClient();
  await adminSb
    .from("subscriptions")
    .update({ status: "expired" })
    .eq("user_id", user.id)
    .eq("status", "active");

  const { error: insertError } = await adminSb.from("subscriptions").insert({
    user_id:               user.id,
    plan,
    billing_key:           billingKey,
    customer_key:          customerKey,
    status:                "active",
    current_period_start:  now.toISOString(),
    current_period_end:    periodEnd.toISOString(),
    cancel_at_period_end:  false,
    toss_order_id:         orderId,
  });

  if (insertError) {
    console.error("[billing-auth] db insert error", insertError);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    plan,
    cardCompany,
    cardNumber,
    periodEnd: periodEnd.toISOString(),
  });
}
