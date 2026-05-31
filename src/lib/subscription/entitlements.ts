import { quotaForSubscriptionPlan, type CommerceSettings } from "../commerce/settings";

export interface ActiveSubscriptionRow {
  id: string;
  plan: string | null;
  status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
}

export interface SubscriptionPricedItem {
  id: string;
  license: string;
  priceKrw: number;
}

export interface SubscriptionCoveredItem extends SubscriptionPricedItem {
  originalPriceKrw: number;
  effectivePriceKrw: number;
  subscriptionCovered: boolean;
}

export interface SubscriptionCoverageResult {
  subscriptionId: string | null;
  subscriptionPlan: string | null;
  quota: number;
  used: number;
  remainingBeforeOrder: number;
  coveredCount: number;
  remainingAfterOrder: number;
  items: SubscriptionCoveredItem[];
}

function dateOrNull(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isSubscriptionActiveNow(
  subscription: ActiveSubscriptionRow | null | undefined,
  now = new Date(),
) {
  if (!subscription || subscription.status !== "active") return false;
  const startsAt = dateOrNull(subscription.current_period_start);
  const endsAt = dateOrNull(subscription.current_period_end);
  if (startsAt && startsAt > now) return false;
  if (endsAt && endsAt <= now) return false;
  return true;
}

export function calculateSubscriptionCoverage({
  items,
  subscription,
  settings,
  usedCount,
  now = new Date(),
}: {
  items: SubscriptionPricedItem[];
  subscription: ActiveSubscriptionRow | null | undefined;
  settings: CommerceSettings;
  usedCount: number;
  now?: Date;
}): SubscriptionCoverageResult {
  const active = isSubscriptionActiveNow(subscription, now);
  const quota = active ? quotaForSubscriptionPlan(settings, subscription?.plan) : 0;
  const used = Math.max(0, Math.trunc(Number.isFinite(usedCount) ? usedCount : 0));
  let remaining = Math.max(0, quota - used);
  let coveredCount = 0;

  const coveredItems = items.map((item) => {
    const canCover = active && item.priceKrw > 0 && remaining > 0;
    if (canCover) {
      remaining -= 1;
      coveredCount += 1;
    }

    return {
      ...item,
      originalPriceKrw: item.priceKrw,
      effectivePriceKrw: canCover ? 0 : item.priceKrw,
      subscriptionCovered: canCover,
    };
  });

  return {
    subscriptionId: active ? subscription?.id ?? null : null,
    subscriptionPlan: active ? subscription?.plan ?? null : null,
    quota,
    used,
    remainingBeforeOrder: Math.max(0, quota - used),
    coveredCount,
    remainingAfterOrder: remaining,
    items: coveredItems,
  };
}
