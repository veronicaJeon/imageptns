export type SubscriptionPlanCode = "basic" | "pro" | "enterprise";

export interface CommerceSettings {
  downloadAccessDays: number;
  subscriptionDownloadQuotas: Record<SubscriptionPlanCode, number>;
  arweaveSelfFundedRequestFeeKrw: number;
}

export interface CommerceSettingsRow {
  download_access_days?: number | null;
  subscription_basic_downloads?: number | null;
  subscription_pro_downloads?: number | null;
  subscription_enterprise_downloads?: number | null;
  arweave_self_funded_request_fee_krw?: number | null;
}

export interface CommerceSettingsPatch {
  download_access_days?: number;
  subscription_basic_downloads?: number;
  subscription_pro_downloads?: number;
  subscription_enterprise_downloads?: number;
  arweave_self_funded_request_fee_krw?: number;
}

export const DEFAULT_COMMERCE_SETTINGS: CommerceSettings = {
  downloadAccessDays: 30,
  subscriptionDownloadQuotas: {
    basic: 5,
    pro: 30,
    enterprise: 100,
  },
  arweaveSelfFundedRequestFeeKrw: 10000,
};

function integerOrFallback(value: unknown, fallback: number, min: number, max: number) {
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount < min || amount > max) return fallback;
  return amount;
}

export function normalizeCommerceSettings(row?: CommerceSettingsRow | null): CommerceSettings {
  return {
    downloadAccessDays: integerOrFallback(
      row?.download_access_days,
      DEFAULT_COMMERCE_SETTINGS.downloadAccessDays,
      1,
      3650,
    ),
    subscriptionDownloadQuotas: {
      basic: integerOrFallback(
        row?.subscription_basic_downloads,
        DEFAULT_COMMERCE_SETTINGS.subscriptionDownloadQuotas.basic,
        0,
        10000,
      ),
      pro: integerOrFallback(
        row?.subscription_pro_downloads,
        DEFAULT_COMMERCE_SETTINGS.subscriptionDownloadQuotas.pro,
        0,
        10000,
      ),
      enterprise: integerOrFallback(
        row?.subscription_enterprise_downloads,
        DEFAULT_COMMERCE_SETTINGS.subscriptionDownloadQuotas.enterprise,
        0,
        10000,
      ),
    },
    arweaveSelfFundedRequestFeeKrw: integerOrFallback(
      row?.arweave_self_funded_request_fee_krw,
      DEFAULT_COMMERCE_SETTINGS.arweaveSelfFundedRequestFeeKrw,
      0,
      10000000,
    ),
  };
}

export function quotaForSubscriptionPlan(
  settings: CommerceSettings,
  plan: string | null | undefined,
) {
  if (plan === "basic" || plan === "pro" || plan === "enterprise") {
    return settings.subscriptionDownloadQuotas[plan];
  }

  return 0;
}

function requiredInteger(value: unknown, field: string, min: number, max: number) {
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount < min || amount > max) {
    throw new Error(`${field} must be an integer between ${min} and ${max}`);
  }
  return amount;
}

export function normalizeCommerceSettingsPatch(input: Record<string, unknown>): CommerceSettingsPatch {
  const patch: CommerceSettingsPatch = {};

  if ("download_access_days" in input) {
    patch.download_access_days = requiredInteger(input.download_access_days, "download_access_days", 1, 3650);
  }
  if ("subscription_basic_downloads" in input) {
    patch.subscription_basic_downloads = requiredInteger(input.subscription_basic_downloads, "subscription_basic_downloads", 0, 10000);
  }
  if ("subscription_pro_downloads" in input) {
    patch.subscription_pro_downloads = requiredInteger(input.subscription_pro_downloads, "subscription_pro_downloads", 0, 10000);
  }
  if ("subscription_enterprise_downloads" in input) {
    patch.subscription_enterprise_downloads = requiredInteger(input.subscription_enterprise_downloads, "subscription_enterprise_downloads", 0, 10000);
  }
  if ("arweave_self_funded_request_fee_krw" in input) {
    patch.arweave_self_funded_request_fee_krw = requiredInteger(
      input.arweave_self_funded_request_fee_krw,
      "arweave_self_funded_request_fee_krw",
      0,
      10000000,
    );
  }

  return patch;
}
