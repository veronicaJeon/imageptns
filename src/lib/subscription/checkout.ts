import { normalizeCommerceSettings, type CommerceSettingsRow } from "@/lib/commerce/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  calculateSubscriptionCoverage,
  isSubscriptionActiveNow,
  type ActiveSubscriptionRow,
  type SubscriptionPricedItem,
} from "./entitlements";

type AdminClient = ReturnType<typeof createAdminClient>;

export async function loadSubscriptionCoverageForCheckout({
  admin,
  userId,
  items,
}: {
  admin: AdminClient;
  userId: string;
  items: SubscriptionPricedItem[];
}) {
  const [{ data: settingsRow }, { data: subscription }] = await Promise.all([
    admin
      .from("platform_commerce_settings")
      .select("download_access_days, subscription_basic_downloads, subscription_pro_downloads, subscription_enterprise_downloads, arweave_self_funded_request_fee_krw")
      .eq("id", true)
      .maybeSingle(),
    admin
      .from("subscriptions")
      .select("id, plan, status, current_period_start, current_period_end")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const activeSubscription = subscription as ActiveSubscriptionRow | null;
  let usedCount = 0;
  if (
    isSubscriptionActiveNow(activeSubscription) &&
    activeSubscription?.current_period_start &&
    activeSubscription.current_period_end
  ) {
    const { count } = await admin
      .from("subscription_download_usages")
      .select("id", { count: "exact", head: true })
      .eq("subscription_id", activeSubscription.id)
      .gte("created_at", activeSubscription.current_period_start)
      .lt("created_at", activeSubscription.current_period_end);
    usedCount = count ?? 0;
  }

  return calculateSubscriptionCoverage({
    items,
    subscription: activeSubscription,
    settings: normalizeCommerceSettings(settingsRow as CommerceSettingsRow | null),
    usedCount,
  });
}
