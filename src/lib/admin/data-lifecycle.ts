export interface DataLifecycleSettings {
  personalDataRetentionDays: number;
  downloadAccessDays: number;
  transactionHistoryRetentionDays: number;
  inactiveAccountRetentionDays: number;
  auditLogRetentionDays: number;
  deletionRequestRetentionDays: number;
}

export interface DataLifecycleSettingsRow {
  personal_data_retention_days?: number | null;
  download_access_days?: number | null;
  transaction_history_retention_days?: number | null;
  inactive_account_retention_days?: number | null;
  audit_log_retention_days?: number | null;
  deletion_request_retention_days?: number | null;
}

export type DataLifecycleSettingsPatch = Required<DataLifecycleSettingsRow>;

export const DEFAULT_DATA_LIFECYCLE_SETTINGS: DataLifecycleSettings = {
  personalDataRetentionDays: 1095,
  downloadAccessDays: 30,
  transactionHistoryRetentionDays: 1825,
  inactiveAccountRetentionDays: 365,
  auditLogRetentionDays: 730,
  deletionRequestRetentionDays: 730,
};

const FIELD_BOUNDS: Record<keyof DataLifecycleSettingsPatch, { min: number; max: number }> = {
  personal_data_retention_days: { min: 30, max: 3650 },
  download_access_days: { min: 1, max: 3650 },
  transaction_history_retention_days: { min: 30, max: 3650 },
  inactive_account_retention_days: { min: 30, max: 3650 },
  audit_log_retention_days: { min: 30, max: 3650 },
  deletion_request_retention_days: { min: 30, max: 3650 },
};

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export function normalizeDataLifecycleSettings(row?: DataLifecycleSettingsRow | null): DataLifecycleSettings {
  return {
    personalDataRetentionDays: boundedInteger(row?.personal_data_retention_days, DEFAULT_DATA_LIFECYCLE_SETTINGS.personalDataRetentionDays, 30, 3650),
    downloadAccessDays: boundedInteger(row?.download_access_days, DEFAULT_DATA_LIFECYCLE_SETTINGS.downloadAccessDays, 1, 3650),
    transactionHistoryRetentionDays: boundedInteger(row?.transaction_history_retention_days, DEFAULT_DATA_LIFECYCLE_SETTINGS.transactionHistoryRetentionDays, 30, 3650),
    inactiveAccountRetentionDays: boundedInteger(row?.inactive_account_retention_days, DEFAULT_DATA_LIFECYCLE_SETTINGS.inactiveAccountRetentionDays, 30, 3650),
    auditLogRetentionDays: boundedInteger(row?.audit_log_retention_days, DEFAULT_DATA_LIFECYCLE_SETTINGS.auditLogRetentionDays, 30, 3650),
    deletionRequestRetentionDays: boundedInteger(row?.deletion_request_retention_days, DEFAULT_DATA_LIFECYCLE_SETTINGS.deletionRequestRetentionDays, 30, 3650),
  };
}

export function normalizeDataLifecycleSettingsPatch(input: Record<string, unknown>): DataLifecycleSettingsPatch {
  const patch = {} as DataLifecycleSettingsPatch;
  for (const field of Object.keys(FIELD_BOUNDS) as Array<keyof DataLifecycleSettingsPatch>) {
    const { min, max } = FIELD_BOUNDS[field];
    const value = Number(input[field]);
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new Error(`${field} must be an integer between ${min} and ${max}`);
    }
    patch[field] = value;
  }
  return patch;
}
