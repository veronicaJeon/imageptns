import { describe, expect, it } from "vitest";
import {
  DEFAULT_DATA_LIFECYCLE_SETTINGS,
  normalizeDataLifecycleSettings,
  normalizeDataLifecycleSettingsPatch,
} from "./data-lifecycle";

describe("data lifecycle settings", () => {
  it("uses safe defaults for missing data", () => {
    expect(normalizeDataLifecycleSettings(null)).toEqual(DEFAULT_DATA_LIFECYCLE_SETTINGS);
  });

  it("validates every administrator-managed retention field", () => {
    const input = {
      personal_data_retention_days: 1000,
      download_access_days: 14,
      transaction_history_retention_days: 1500,
      inactive_account_retention_days: 400,
      audit_log_retention_days: 800,
      deletion_request_retention_days: 900,
      rejected_image_retention_days: 7,
    };
    expect(normalizeDataLifecycleSettingsPatch(input)).toEqual(input);
    expect(() => normalizeDataLifecycleSettingsPatch({ ...input, download_access_days: 0 })).toThrow(/download_access_days/);
  });
});
