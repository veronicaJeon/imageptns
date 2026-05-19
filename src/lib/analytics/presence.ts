export const ACTIVE_PRESENCE_WINDOW_MS = 2 * 60 * 1000;

export function activePresenceSince(now = new Date()) {
  return new Date(now.getTime() - ACTIVE_PRESENCE_WINDOW_MS);
}

export function isActivePresence(lastSeenAt: string | Date, now = new Date()) {
  const lastSeen = typeof lastSeenAt === "string" ? new Date(lastSeenAt) : lastSeenAt;
  if (Number.isNaN(lastSeen.getTime())) return false;
  return lastSeen >= activePresenceSince(now);
}
