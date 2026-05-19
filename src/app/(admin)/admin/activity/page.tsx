"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils/cn";

type EventType =
  | "all"
  | "page_view"
  | "image_view"
  | "search"
  | "cart_add"
  | "checkout_started"
  | "download";

interface ActivityEvent {
  id: string;
  user_id: string | null;
  session_id: string | null;
  event_type: string;
  path: string | null;
  image_id: string | null;
  order_id: string | null;
  referrer: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  user?: { id: string; full_name: string | null; role?: string | null } | null;
  image?: { id: string; title: string | null; asset_id: string | null } | null;
}

const FILTERS: { key: EventType; label: string; icon: string }[] = [
  { key: "all", label: "전체", icon: "grid_view" },
  { key: "page_view", label: "페이지", icon: "visibility" },
  { key: "image_view", label: "이미지", icon: "image" },
  { key: "search", label: "검색", icon: "search" },
  { key: "cart_add", label: "장바구니", icon: "add_shopping_cart" },
  { key: "checkout_started", label: "결제 시작", icon: "shopping_cart_checkout" },
  { key: "download", label: "다운로드", icon: "download" },
];

const EVENT_LABELS: Record<string, string> = {
  page_view: "페이지 조회",
  image_view: "이미지 조회",
  search: "검색",
  cart_add: "장바구니 추가",
  checkout_started: "결제 시작",
  download: "다운로드",
};

const EVENT_STYLES: Record<string, string> = {
  page_view: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-200",
  image_view: "bg-primary/10 text-primary",
  search: "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-200",
  cart_add: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-200",
  checkout_started: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200",
  download: "bg-surface-container-high text-on-surface-variant",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortId(value: string | null | undefined) {
  if (!value) return null;
  return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

function jsonPreview(value: unknown) {
  if (!value || (typeof value === "object" && Object.keys(value as object).length === 0)) return "{}";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function AdminActivityPage() {
  const [eventType, setEventType] = useState<EventType>("all");
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async (filter: EventType) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/activity?eventType=${filter}`);
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      const { events: rows } = await res.json();
      setEvents(rows ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(eventType); }, [eventType, load]);

  const currentFilter = useMemo(
    () => FILTERS.find((filter) => filter.key === eventType) ?? FILTERS[0],
    [eventType],
  );

  if (forbidden) {
    return (
      <div className="p-10 flex flex-col items-center justify-center min-h-[60vh] gap-4 text-outline">
        <span className="material-symbols-outlined text-6xl text-error">lock</span>
        <h1 className="font-headline text-xl font-extrabold text-on-surface">접근 권한이 없습니다</h1>
        <p className="text-sm">관리자 계정이 아닙니다.</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-8">
        <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">활동 로그</h1>
        <p className="text-sm text-outline mt-1">
          {!loading && `최근 ${events.length.toLocaleString("ko-KR")}건의 ${currentFilter.label} 이벤트`}
        </p>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
        <div className="hidden md:flex gap-1 bg-surface-container-lowest p-1 rounded-xl w-fit shadow-ghost">
          {FILTERS.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setEventType(key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200",
                eventType === key ? "bg-primary text-white shadow-sm" : "text-on-surface-variant hover:text-on-surface",
              )}
            >
              <span className="material-symbols-outlined text-base">{icon}</span>
              {label}
            </button>
          ))}
        </div>
        <label className="md:hidden flex items-center gap-2 bg-surface-container-lowest shadow-ghost rounded-xl px-3 py-2">
          <span className="material-symbols-outlined text-base text-outline">filter_list</span>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value as EventType)}
            className="flex-1 bg-transparent text-sm font-bold text-on-surface outline-none"
          >
            {FILTERS.map(({ key, label }) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center py-32 gap-4 text-outline">
          <span className="material-symbols-outlined text-6xl">timeline</span>
          <p className="text-base">활동 로그가 없습니다.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {events.map((event) => (
            <div key={event.id} className="bg-surface-container-lowest shadow-ghost rounded-xl overflow-hidden">
              <div className="p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="material-symbols-outlined text-base text-on-surface-variant">{currentFilter.icon}</span>
                      <h2 className="font-headline font-bold text-base text-on-surface">
                        {EVENT_LABELS[event.event_type] ?? event.event_type}
                      </h2>
                      {event.path && <span className="text-xs text-outline truncate max-w-full">{event.path}</span>}
                    </div>
                    <p className="text-xs text-outline mt-1">{formatDateTime(event.created_at)}</p>
                  </div>
                  <span className={cn("text-[10px] font-bold px-3 py-1 rounded-full shrink-0", EVENT_STYLES[event.event_type] ?? "bg-surface-container text-outline")}>
                    {event.event_type}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wide">
                  <span className="bg-surface-container-low text-on-surface-variant px-2.5 py-1 rounded-full flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">person</span>
                    {event.user?.full_name ?? shortId(event.user_id) ?? "Guest"}
                  </span>
                  {event.session_id && (
                    <span className="bg-surface-container-low text-on-surface-variant px-2.5 py-1 rounded-full">
                      Session {shortId(event.session_id)}
                    </span>
                  )}
                  {event.image && (
                    <span className="bg-surface-container-low text-on-surface-variant px-2.5 py-1 rounded-full">
                      {event.image.title ?? event.image.asset_id ?? shortId(event.image_id)}
                    </span>
                  )}
                  {event.order_id && (
                    <span className="bg-surface-container-low text-on-surface-variant px-2.5 py-1 rounded-full">
                      Order {shortId(event.order_id)}
                    </span>
                  )}
                </div>

                <div className="grid gap-3 lg:grid-cols-[1fr_1.3fr]">
                  <div className="flex flex-col gap-2 text-xs text-on-surface-variant min-w-0">
                    {event.referrer && (
                      <p className="truncate"><span className="font-bold text-outline">Referrer</span> {event.referrer}</p>
                    )}
                    {event.user_agent && (
                      <p className="truncate"><span className="font-bold text-outline">Agent</span> {event.user_agent}</p>
                    )}
                  </div>
                  <pre className="max-h-28 overflow-auto rounded-lg bg-surface-container-low border border-outline-variant/30 px-3 py-2 text-[11px] leading-relaxed text-on-surface-variant">
                    {jsonPreview(event.metadata)}
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
