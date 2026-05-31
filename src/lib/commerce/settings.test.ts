import { describe, expect, it } from "vitest";
import {
  DEFAULT_COMMERCE_SETTINGS,
  normalizeCommerceSettings,
  normalizeCommerceSettingsPatch,
  quotaForSubscriptionPlan,
} from "./settings";

describe("normalizeCommerceSettings", () => {
  it("falls back to operational defaults for missing or invalid rows", () => {
    expect(normalizeCommerceSettings(null)).toEqual(DEFAULT_COMMERCE_SETTINGS);
    expect(normalizeCommerceSettings({
      download_access_days: 0,
      subscription_basic_downloads: -1,
      subscription_pro_downloads: 1.5,
      subscription_enterprise_downloads: 20000,
      arweave_self_funded_request_fee_krw: -100,
    })).toEqual(DEFAULT_COMMERCE_SETTINGS);
  });

  it("maps valid database settings into the commerce config", () => {
    expect(normalizeCommerceSettings({
      download_access_days: 14,
      subscription_basic_downloads: 3,
      subscription_pro_downloads: 20,
      subscription_enterprise_downloads: 250,
      arweave_self_funded_request_fee_krw: 15000,
    })).toEqual({
      downloadAccessDays: 14,
      subscriptionDownloadQuotas: {
        basic: 3,
        pro: 20,
        enterprise: 250,
      },
      arweaveSelfFundedRequestFeeKrw: 15000,
    });
  });
});

describe("quotaForSubscriptionPlan", () => {
  it("returns zero for unsupported plans", () => {
    const settings = normalizeCommerceSettings(null);
    expect(quotaForSubscriptionPlan(settings, "basic")).toBe(5);
    expect(quotaForSubscriptionPlan(settings, "unknown")).toBe(0);
    expect(quotaForSubscriptionPlan(settings, null)).toBe(0);
  });
});

describe("normalizeCommerceSettingsPatch", () => {
  it("accepts zero subscription quota and validates bounded integers", () => {
    expect(normalizeCommerceSettingsPatch({
      download_access_days: 45,
      subscription_basic_downloads: 0,
      arweave_self_funded_request_fee_krw: 0,
    })).toEqual({
      download_access_days: 45,
      subscription_basic_downloads: 0,
      arweave_self_funded_request_fee_krw: 0,
    });

    expect(() => normalizeCommerceSettingsPatch({ download_access_days: 0 })).toThrow(/download_access_days/);
    expect(() => normalizeCommerceSettingsPatch({ subscription_pro_downloads: 1.2 })).toThrow(/subscription_pro_downloads/);
  });
});
