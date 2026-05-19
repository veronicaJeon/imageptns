export const ONCHAIN_CONFIRM_BACKOFF_SECONDS = [15, 30, 60, 120, 300, 600, 900, 1800] as const;

interface ConfirmAttemptState {
  backoffUntil?: string | null;
}

type ConfirmAttemptDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export function getConfirmAttemptDecision(
  state: ConfirmAttemptState,
  now = new Date(),
): ConfirmAttemptDecision {
  if (!state.backoffUntil) return { allowed: true };

  const backoffTime = Date.parse(state.backoffUntil);
  if (!Number.isFinite(backoffTime) || backoffTime <= now.getTime()) return { allowed: true };

  return {
    allowed: false,
    retryAfterSeconds: Math.ceil((backoffTime - now.getTime()) / 1000),
  };
}

export function getNextConfirmBackoffUntil(attemptsAfterFailure: number, now = new Date()) {
  const safeAttempt = Math.max(1, Math.floor(attemptsAfterFailure));
  const index = Math.min(safeAttempt - 1, ONCHAIN_CONFIRM_BACKOFF_SECONDS.length - 1);
  return new Date(now.getTime() + ONCHAIN_CONFIRM_BACKOFF_SECONDS[index] * 1000);
}
