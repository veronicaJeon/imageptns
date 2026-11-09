export const ADMIN_ANALYTICS_RANGES = [7, 30, 90] as const;

export type AdminAnalyticsRange = (typeof ADMIN_ANALYTICS_RANGES)[number];

export interface AnalyticsSummary {
  visitors: number;
  sessions: number;
  pageViews: number;
  imageViews: number;
  searches: number;
  downloads: number;
  newMembers: number;
  completedOrders: number;
  revenue: number;
}

export interface AdminAnalyticsDashboard {
  range: {
    days: number;
    start: string;
    end: string;
    timezone: string;
  };
  summary: AnalyticsSummary;
  previous: AnalyticsSummary;
  daily: Array<{
    date: string;
    visitors: number;
    page_views: number;
    image_views: number;
    searches: number;
    orders: number;
    revenue: number;
  }>;
  funnel: {
    visitors: number;
    imageViewers: number;
    cartUsers: number;
    checkoutUsers: number;
    purchasers: number;
  };
  audience: {
    logged_in: number;
    guests: number;
    new_visitors: number;
    returning_visitors: number;
    mobile: number;
    desktop: number;
  };
  topPages: Array<{ path: string; views: number }>;
  topImages: Array<{ id: string; title: string; asset_id: string | null; views: number }>;
  topSearches: Array<{ query: string; searches: number }>;
  zeroResultSearches: Array<{ query: string; searches: number }>;
  filters: {
    bots: boolean;
    adminPaths: boolean;
    developmentHosts: boolean;
  };
}

export function isAdminAnalyticsRange(value: number): value is AdminAnalyticsRange {
  return ADMIN_ANALYTICS_RANGES.includes(value as AdminAnalyticsRange);
}

export function analyticsChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function analyticsRate(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (value / total) * 100));
}
