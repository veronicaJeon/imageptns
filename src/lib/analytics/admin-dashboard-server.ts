import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminAnalyticsDashboard, AnalyticsSummary } from "./admin-dashboard";

type EventRow = {
  id: string;
  user_id: string | null;
  session_id: string | null;
  event_type: string;
  path: string | null;
  image_id: string | null;
  referrer: string | null;
  user_agent: string | null;
  ip_hash: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type OrderRow = {
  buyer_id: string;
  total_krw: number | null;
  completed_at: string;
};

const DAY_MS = 86_400_000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const BOT_PATTERN = /bot|crawler|spider|slurp|headless|lighthouse|pagespeed|pingdom|uptime|facebookexternalhit|twitterbot|linkedinbot|discordbot|whatsapp|curl|wget|python-requests|postmanruntime|insomnia/i;
const DEVELOPMENT_REFERRER_PATTERN = /(?:^|[/:.])(?:localhost|127\.0\.0\.1)(?::|\/|$)|\.vercel\.app|\.pages\.dev/i;

function kstDate(timestamp: string | number) {
  const time = typeof timestamp === "number" ? timestamp : new Date(timestamp).getTime();
  return new Date(time + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function visitorKey(event: EventRow) {
  if (event.user_id) return `user:${event.user_id}`;
  if (event.session_id?.trim()) return `session:${event.session_id.trim()}`;
  if (event.ip_hash?.trim()) return `ip:${event.ip_hash.trim()}`;
  return null;
}

function isReportableEvent(event: EventRow) {
  return !/^\/admin(?:\/|$)/.test(event.path ?? "")
    && !BOT_PATTERN.test(event.user_agent ?? "")
    && !DEVELOPMENT_REFERRER_PATTERN.test(event.referrer ?? "");
}

function summarizeEvents(events: EventRow[]): Pick<AnalyticsSummary, "visitors" | "sessions" | "pageViews" | "imageViews" | "searches" | "downloads"> {
  const visitors = new Set<string>();
  const sessions = new Set<string>();
  let pageViews = 0;
  let imageViews = 0;
  let searches = 0;
  let downloads = 0;

  for (const event of events) {
    const key = visitorKey(event);
    if (key) {
      visitors.add(key);
      sessions.add(event.session_id?.trim() || `${key}:${kstDate(event.created_at)}`);
    }
    if (event.event_type === "page_view") pageViews += 1;
    if (event.event_type === "image_view") imageViews += 1;
    if (event.event_type === "search") searches += 1;
    if (event.event_type === "download") downloads += 1;
  }

  return { visitors: visitors.size, sessions: sessions.size, pageViews, imageViews, searches, downloads };
}

async function fetchEventWindow(admin: SupabaseClient, start: string, end: string) {
  const rows: EventRow[] = [];
  const pageSize = 1000;
  for (let from = 0; from < 100_000; from += pageSize) {
    const { data, error } = await admin
      .from("user_events")
      .select("id, user_id, session_id, event_type, path, image_id, referrer, user_agent, ip_hash, metadata, created_at")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as EventRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows.filter(isReportableEvent);
}

function countBy<T>(items: T[], key: (item: T) => string | null) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = key(item);
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

/** Compatibility path used only until migration 083 is installed in an environment. */
export async function aggregateAdminAnalyticsFallback(
  admin: SupabaseClient,
  days: number,
): Promise<AdminAnalyticsDashboard> {
  const now = Date.now();
  const currentKstDay = Math.floor((now + KST_OFFSET_MS) / DAY_MS);
  const startMs = (currentKstDay - (days - 1)) * DAY_MS - KST_OFFSET_MS;
  const previousStartMs = startMs - days * DAY_MS;
  const start = new Date(startMs).toISOString();
  const previousStart = new Date(previousStartMs).toISOString();
  const end = new Date(now).toISOString();

  const [events, ordersResult, currentMembersResult, previousMembersResult] = await Promise.all([
    fetchEventWindow(admin, previousStart, end),
    admin.from("orders").select("buyer_id, total_krw, completed_at").eq("status", "completed").gte("completed_at", previousStart).lt("completed_at", end),
    admin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", start).lt("created_at", end),
    admin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", previousStart).lt("created_at", start),
  ]);
  if (ordersResult.error) throw ordersResult.error;
  if (currentMembersResult.error) throw currentMembersResult.error;
  if (previousMembersResult.error) throw previousMembersResult.error;

  const currentEvents = events.filter((event) => new Date(event.created_at).getTime() >= startMs);
  const previousEvents = events.filter((event) => new Date(event.created_at).getTime() < startMs);
  const currentOrders = ((ordersResult.data ?? []) as OrderRow[]).filter((order) => new Date(order.completed_at).getTime() >= startMs);
  const previousOrders = ((ordersResult.data ?? []) as OrderRow[]).filter((order) => new Date(order.completed_at).getTime() < startMs);
  const currentEventSummary = summarizeEvents(currentEvents);
  const previousEventSummary = summarizeEvents(previousEvents);

  const orderSummary = (orders: OrderRow[]) => ({
    completedOrders: orders.length,
    revenue: orders.reduce((sum, order) => sum + (order.total_krw ?? 0), 0),
  });
  const currentOrderSummary = orderSummary(currentOrders);
  const previousOrderSummary = orderSummary(previousOrders);
  const summary: AnalyticsSummary = {
    ...currentEventSummary,
    newMembers: currentMembersResult.count ?? 0,
    ...currentOrderSummary,
  };
  const previous: AnalyticsSummary = {
    ...previousEventSummary,
    newMembers: previousMembersResult.count ?? 0,
    ...previousOrderSummary,
  };

  const daily = Array.from({ length: days }, (_, index) => {
    const date = kstDate(startMs + index * DAY_MS);
    const dayEvents = currentEvents.filter((event) => kstDate(event.created_at) === date);
    const dayOrders = currentOrders.filter((order) => kstDate(order.completed_at) === date);
    return {
      date,
      visitors: new Set(dayEvents.map(visitorKey).filter(Boolean)).size,
      page_views: dayEvents.filter((event) => event.event_type === "page_view").length,
      image_views: dayEvents.filter((event) => event.event_type === "image_view").length,
      searches: dayEvents.filter((event) => event.event_type === "search").length,
      orders: dayOrders.length,
      revenue: dayOrders.reduce((sum, order) => sum + (order.total_krw ?? 0), 0),
    };
  });

  const currentVisitorRows = new Map<string, EventRow>();
  const firstSeen = new Map<string, number>();
  for (const event of events) {
    const key = visitorKey(event);
    if (!key) continue;
    const time = new Date(event.created_at).getTime();
    firstSeen.set(key, Math.min(firstSeen.get(key) ?? time, time));
    if (time >= startMs) currentVisitorRows.set(key, event);
  }
  const visitors = [...currentVisitorRows.entries()];
  const imageViewers = new Set(currentEvents.filter((event) => event.event_type === "image_view").map(visitorKey).filter(Boolean));
  const cartUsers = new Set(currentEvents.filter((event) => event.event_type === "cart_add").map(visitorKey).filter(Boolean));
  const checkoutUsers = new Set(currentEvents.filter((event) => event.event_type === "checkout_started").map(visitorKey).filter(Boolean));

  const imageCounts = countBy(currentEvents.filter((event) => event.event_type === "image_view"), (event) => event.image_id);
  const imageIds = imageCounts.slice(0, 7).map(([id]) => id);
  const { data: imageRows, error: imageError } = imageIds.length > 0
    ? await admin.from("images").select("id, title, title_ko, asset_id").in("id", imageIds)
    : { data: [], error: null };
  if (imageError) throw imageError;
  const images = new Map((imageRows ?? []).map((image) => [image.id, image]));

  const searchEvents = currentEvents.filter((event) => event.event_type === "search");
  const searchQuery = (event: EventRow) => typeof event.metadata?.query === "string" ? event.metadata.query.trim() || null : null;
  const zeroSearchEvents = searchEvents.filter((event) => Number(event.metadata?.resultCount) === 0);

  return {
    range: { days, start, end, timezone: "Asia/Seoul" },
    summary,
    previous,
    daily,
    funnel: {
      visitors: currentEventSummary.visitors,
      imageViewers: imageViewers.size,
      cartUsers: cartUsers.size,
      checkoutUsers: checkoutUsers.size,
      purchasers: new Set(currentOrders.map((order) => order.buyer_id)).size,
    },
    audience: {
      logged_in: visitors.filter(([, event]) => event.user_id).length,
      guests: visitors.filter(([, event]) => !event.user_id).length,
      new_visitors: visitors.filter(([key]) => (firstSeen.get(key) ?? 0) >= startMs).length,
      returning_visitors: visitors.filter(([key]) => (firstSeen.get(key) ?? 0) < startMs).length,
      mobile: visitors.filter(([, event]) => /mobile|android|iphone|ipad/i.test(event.user_agent ?? "")).length,
      desktop: visitors.filter(([, event]) => !/mobile|android|iphone|ipad/i.test(event.user_agent ?? "")).length,
    },
    topPages: countBy(currentEvents.filter((event) => event.event_type === "page_view"), (event) => event.path?.trim() || null)
      .slice(0, 7).map(([path, views]) => ({ path, views })),
    topImages: imageCounts.slice(0, 7).map(([id, views]) => {
      const image = images.get(id);
      return { id, title: image?.title_ko || image?.title || "제목 없음", asset_id: image?.asset_id ?? null, views };
    }),
    topSearches: countBy(searchEvents, searchQuery).slice(0, 7).map(([query, searches]) => ({ query, searches })),
    zeroResultSearches: countBy(zeroSearchEvents, searchQuery).slice(0, 7).map(([query, searches]) => ({ query, searches })),
    filters: { bots: true, adminPaths: true, developmentHosts: true },
  };
}
