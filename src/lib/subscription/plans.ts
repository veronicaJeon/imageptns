export const PLAN_PRICES: Record<string, number> = {
  basic: 29000,
  pro: 79000,
  enterprise: 199000,
};

export const PLAN_PRICES_ANNUAL: Record<string, number> = {
  basic: 23200,
  pro: 63200,
  enterprise: 159200,
};

export function subscriptionAmount(plan: string, annual: boolean) {
  return annual ? PLAN_PRICES_ANNUAL[plan] : PLAN_PRICES[plan];
}

export function nextPeriodEnd(from: Date, annual: boolean) {
  const next = new Date(from);
  if (annual) next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next;
}
