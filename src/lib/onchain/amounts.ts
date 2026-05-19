import { USDC_DECIMALS } from "./chains";

interface ScaledDecimal {
  value: bigint;
  decimals: number;
}

function normalizeDecimalString(value: number | string, name: string): string {
  const raw = String(value).trim();
  const match = raw.match(/^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i);
  if (!match) throw new Error(`${name} must be a positive decimal`);

  const [, whole, fraction = "", exponentRaw] = match;
  const exponent = exponentRaw === undefined ? 0 : Number(exponentRaw);
  if (!Number.isInteger(exponent)) throw new Error(`${name} must be a positive decimal`);

  const digits = `${whole}${fraction}`;
  const decimalPlaces = fraction.length - exponent;
  if (decimalPlaces <= 0) return `${digits}${"0".repeat(Math.abs(decimalPlaces))}`;
  if (decimalPlaces >= digits.length) return `0.${"0".repeat(decimalPlaces - digits.length)}${digits}`;
  return `${digits.slice(0, -decimalPlaces)}.${digits.slice(-decimalPlaces)}`;
}

function parsePositiveDecimal(value: number, name: string): ScaledDecimal {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be positive`);

  const normalized = normalizeDecimalString(value, name);
  const [whole, fraction = ""] = normalized.split(".");
  const digits = `${whole}${fraction}`.replace(/^0+/, "") || "0";
  const scaledValue = BigInt(digits);
  if (scaledValue <= BigInt(0)) throw new Error(`${name} must be positive`);

  return {
    value: scaledValue,
    decimals: fraction.length,
  };
}

function pow10(exponent: number): bigint {
  if (!Number.isInteger(exponent) || exponent < 0) throw new Error("Decimal scale must be a non-negative integer");
  return BigInt(10) ** BigInt(exponent);
}

function divideRounded(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder * BigInt(2) >= denominator ? quotient + BigInt(1) : quotient;
}

export function krwToUsdcAmount(krw: number, usdcPerKrw: number): bigint {
  if (!Number.isFinite(krw) || krw <= 0) throw new Error("KRW amount must be positive");
  if (!Number.isFinite(usdcPerKrw) || usdcPerKrw <= 0) throw new Error("USDC quote must be positive");

  const krwDecimal = parsePositiveDecimal(krw, "KRW amount");
  const quoteDecimal = parsePositiveDecimal(usdcPerKrw, "USDC quote");
  const numerator = krwDecimal.value * quoteDecimal.value * pow10(USDC_DECIMALS);
  const denominator = pow10(krwDecimal.decimals + quoteDecimal.decimals);

  return divideRounded(numerator, denominator);
}

export function bigintToDecimalString(value: bigint, decimals = USDC_DECIMALS): string {
  if (!Number.isInteger(decimals) || decimals < 0) throw new Error("decimals must be a non-negative integer");
  if (decimals === 0) return value.toString();

  const sign = value < BigInt(0) ? "-" : "";
  const raw = (value < BigInt(0) ? -value : value).toString().padStart(decimals + 1, "0");
  const whole = raw.slice(0, -decimals);
  const fraction = raw.slice(-decimals).replace(/0+$/, "");
  return `${sign}${fraction ? `${whole}.${fraction}` : whole}`;
}
