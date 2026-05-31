import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCommerceSettings, quotaForSubscriptionPlan, type CommerceSettingsRow } from "@/lib/commerce/settings";
import { isSubscriptionActiveNow, type ActiveSubscriptionRow } from "@/lib/subscription/entitlements";

/** GET /api/subscription — 현재 유저의 활성 구독 조회 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: subscription, error } = await supabase
    .from("subscriptions")
    .select("id, plan, status, current_period_start, current_period_end, cancel_at_period_end, created_at")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const admin = createAdminClient();
  const { data: settingsRow } = await admin
    .from("platform_commerce_settings")
    .select("download_access_days, subscription_basic_downloads, subscription_pro_downloads, subscription_enterprise_downloads, arweave_self_funded_request_fee_krw")
    .eq("id", true)
    .maybeSingle();
  const settings = normalizeCommerceSettings(settingsRow as CommerceSettingsRow | null);

  let usageCount = 0;
  if (subscription && isSubscriptionActiveNow(subscription as ActiveSubscriptionRow)) {
    const { count } = await admin
      .from("subscription_download_usages")
      .select("id", { count: "exact", head: true })
      .eq("subscription_id", subscription.id)
      .gte("created_at", subscription.current_period_start)
      .lt("created_at", subscription.current_period_end);
    usageCount = count ?? 0;
  }

  const quota = quotaForSubscriptionPlan(settings, subscription?.plan);

  return NextResponse.json({
    subscription,
    entitlement: {
      active: isSubscriptionActiveNow(subscription as ActiveSubscriptionRow | null),
      quota,
      used: usageCount,
      remaining: Math.max(0, quota - usageCount),
      downloadAccessDays: settings.downloadAccessDays,
    },
  });
}

/** DELETE /api/subscription — 구독 취소 (기간 종료 시 해지) */
export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 활성 구독 조회
  const { data: subscription, error: fetchError } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!subscription) {
    return NextResponse.json({ error: "No active subscription" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("subscriptions")
    .update({ cancel_at_period_end: true })
    .eq("id", subscription.id)
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
