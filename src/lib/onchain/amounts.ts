import { parseUnits } from "viem";
import { USDC_DECIMALS } from "./chains";

export function krwToUsdcAmount(krw: number, usdcPerKrw: number): bigint {
  if (!Number.isFinite(krw) || krw <= 0) throw new Error("KRW amount must be positive");
  if (!Number.isFinite(usdcPerKrw) || usdcPerKrw <= 0) throw new Error("USDC quote must be positive");
  const usdc = krw * usdcPerKrw;
  return parseUnits(usdc.toFixed(USDC_DECIMALS), USDC_DECIMALS);
}

export function bigintToDecimalString(value: bigint, decimals = USDC_DECIMALS): string {
  const raw = value.toString().padStart(decimals + 1, "0");
  const whole = raw.slice(0, -decimals);
  const fraction = raw.slice(-decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}
