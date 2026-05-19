export const ONCHAIN_PENDING_STALE_MINUTES = 30;

export function getOnchainPendingAgeMinutes(createdAt: string, now = new Date()) {
  const createdMs = Date.parse(createdAt);
  if (!Number.isFinite(createdMs)) return 0;
  const elapsedMs = now.getTime() - createdMs;
  if (elapsedMs <= 0) return 0;
  return Math.floor(elapsedMs / 60_000);
}

export function isStaleOnchainPendingOrder(
  createdAt: string,
  now = new Date(),
  staleMinutes = ONCHAIN_PENDING_STALE_MINUTES,
) {
  return getOnchainPendingAgeMinutes(createdAt, now) >= staleMinutes;
}
