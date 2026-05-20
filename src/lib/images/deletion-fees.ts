import { DEFAULT_DELETION_FEE_CONFIG, type DeletionFeeConfig } from "./deletion";

export interface DeletionFeeSettingRow {
  code: string | null;
  amount_krw: number | null;
  active?: boolean | null;
}

export const DELETION_FEE_SETTING_CODES = {
  simple: "image_delete_simple",
  complex: "image_delete_complex",
} as const;

function usableAmount(value: number | null | undefined) {
  const amount = Number(value);
  return Number.isInteger(amount) && amount >= 0 ? amount : null;
}

export function normalizeDeletionFeeConfig(rows: DeletionFeeSettingRow[] | null | undefined): DeletionFeeConfig {
  const config = { ...DEFAULT_DELETION_FEE_CONFIG };

  for (const row of rows ?? []) {
    if (row.active === false) continue;
    const amount = usableAmount(row.amount_krw);
    if (amount === null) continue;

    if (row.code === DELETION_FEE_SETTING_CODES.simple) {
      config.simpleFeeKrw = amount;
    }
    if (row.code === DELETION_FEE_SETTING_CODES.complex) {
      config.complexFeeKrw = amount;
    }
  }

  return config;
}
