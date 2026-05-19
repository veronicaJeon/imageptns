export const ONCHAIN_QUOTE_TTL_MINUTES = 15;
export const STATIC_ONCHAIN_QUOTE_SOURCE = "env:ONCHAIN_USDC_PER_KRW";

export interface OnchainQuoteSnapshot {
  usdcPerKrw: number;
  source: string;
  createdAt: string;
  expiresAt: string;
  ttlMinutes: number;
}

export function createStaticKrwUsdcQuote(
  usdcPerKrw: number,
  now = new Date(),
  ttlMinutes = ONCHAIN_QUOTE_TTL_MINUTES,
): OnchainQuoteSnapshot {
  if (!Number.isFinite(usdcPerKrw) || usdcPerKrw <= 0) throw new Error("USDC quote must be positive");
  if (!Number.isInteger(ttlMinutes) || ttlMinutes <= 0) throw new Error("Quote TTL must be a positive integer");

  return {
    usdcPerKrw,
    source: STATIC_ONCHAIN_QUOTE_SOURCE,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMinutes * 60_000).toISOString(),
    ttlMinutes,
  };
}

export function isQuoteExpired(expiresAt: string | null | undefined, now = new Date()) {
  if (!expiresAt) return false;
  const expiryTime = Date.parse(expiresAt);
  return Number.isFinite(expiryTime) && now.getTime() >= expiryTime;
}
