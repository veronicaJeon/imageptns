export type CommissionScope = "default" | "license" | "photographer" | "image";

export interface CommissionPolicy {
  id: string;
  scope: CommissionScope;
  rate: number;
  active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  license_code?: string | null;
  photographer_id?: string | null;
  image_id?: string | null;
}

export interface CommissionContext {
  imageId?: string | null;
  photographerId?: string | null;
  licenseCode?: string | null;
  now?: Date;
  policies: CommissionPolicy[];
}

export const DEFAULT_COMMISSION_RATE = 0.2;

const SCOPE_PRIORITY: Record<CommissionScope, number> = {
  image: 4,
  photographer: 3,
  license: 2,
  default: 1,
};

function isWithinWindow(policy: CommissionPolicy, now: Date) {
  if (policy.starts_at && new Date(policy.starts_at) > now) return false;
  if (policy.ends_at && new Date(policy.ends_at) <= now) return false;
  return true;
}

function matchesContext(policy: CommissionPolicy, context: CommissionContext) {
  if (!policy.active || !isWithinWindow(policy, context.now ?? new Date())) return false;

  if (policy.scope === "default") return true;
  if (policy.scope === "license") return policy.license_code === context.licenseCode;
  if (policy.scope === "photographer") return policy.photographer_id === context.photographerId;
  if (policy.scope === "image") return policy.image_id === context.imageId;

  return false;
}

export function selectCommissionPolicy(context: CommissionContext): CommissionPolicy {
  const selected = context.policies
    .filter((policy) => matchesContext(policy, context))
    .sort((a, b) => {
      const priorityDelta = SCOPE_PRIORITY[b.scope] - SCOPE_PRIORITY[a.scope];
      if (priorityDelta !== 0) return priorityDelta;
      return new Date(b.starts_at ?? 0).getTime() - new Date(a.starts_at ?? 0).getTime();
    })[0];

  return selected ?? {
    id: "fallback-default",
    scope: "default",
    rate: DEFAULT_COMMISSION_RATE,
    active: true,
  };
}

export function calculateCommission(grossKrw: number, commissionRate: number) {
  const commissionKrw = Math.round(grossKrw * commissionRate);

  return {
    grossKrw,
    commissionRate,
    commissionKrw,
    netKrw: grossKrw - commissionKrw,
  };
}
