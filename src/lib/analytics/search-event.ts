// Library text searches are recorded as `search` user events so operators can
// see which queries return nothing and add tags or source images for them.
// Only the query, result count and filters are sent; the photo search never
// records an event because its input image must not be stored.

export const ACTIVITY_SESSION_KEY = "imageptns.activitySessionId";
const MAX_QUERY_LENGTH = 100;

export interface LibrarySearchEventInput {
  query: string;
  resultCount: number;
  hasMore: boolean;
  searchSource: string | null | undefined;
  category: string;
  orientation: string;
  usageFilters: string[];
}

export function buildLibrarySearchEvent(input: LibrarySearchEventInput, sessionId: string | null) {
  return {
    eventType: "search" as const,
    sessionId,
    path: "/library",
    metadata: {
      query: input.query.trim().replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH),
      resultCount: Math.max(0, Math.trunc(input.resultCount)),
      hasMore: input.hasMore,
      searchSource: input.searchSource ?? null,
      category: input.category,
      orientation: input.orientation,
      usageFilters: input.usageFilters.slice(0, 4),
    },
  };
}

export function sendLibrarySearchEvent(input: LibrarySearchEventInput) {
  let sessionId: string | null = null;
  try {
    sessionId = window.localStorage.getItem(ACTIVITY_SESSION_KEY);
  } catch {
    // Storage can be unavailable; the event is still useful without a session.
  }
  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildLibrarySearchEvent(input, sessionId)),
    keepalive: true,
  }).catch(() => {});
}

export interface ZeroResultQuery {
  query: string;
  count: number;
  lastSeenAt: string;
}

/** Groups recent `search` events whose first page was empty, most frequent first. */
export function summarizeZeroResultQueries(
  events: ReadonlyArray<{ event_type: string; metadata: Record<string, unknown> | null; created_at: string }>,
  limit = 10,
): ZeroResultQuery[] {
  const grouped = new Map<string, ZeroResultQuery>();
  for (const event of events) {
    if (event.event_type !== "search" || event.metadata?.resultCount !== 0) continue;
    const query = typeof event.metadata.query === "string" ? event.metadata.query.trim() : "";
    if (!query) continue;
    const key = query.toLowerCase();
    const current = grouped.get(key);
    if (current) {
      current.count += 1;
      if (event.created_at > current.lastSeenAt) current.lastSeenAt = event.created_at;
    } else {
      grouped.set(key, { query, count: 1, lastSeenAt: event.created_at });
    }
  }
  return [...grouped.values()]
    .sort((left, right) => right.count - left.count || right.lastSeenAt.localeCompare(left.lastSeenAt))
    .slice(0, limit);
}
