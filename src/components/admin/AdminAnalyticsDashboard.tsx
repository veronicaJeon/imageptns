"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminButton, AdminChip, AdminInlineMetrics, AdminListSurface } from "@/components/admin/AdminPrimitives";
import {
  ADMIN_ANALYTICS_RANGES,
  type AdminAnalyticsDashboard as DashboardData,
  type AdminAnalyticsRange,
  analyticsChange,
  analyticsRate,
} from "@/lib/analytics/admin-dashboard";
import { cn } from "@/lib/utils/cn";

const numberFormatter = new Intl.NumberFormat("ko-KR");
const currencyFormatter = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

function ChangeLabel({ current, previous }: { current: number; previous: number }) {
  const change = analyticsChange(current, previous);
  if (change === null) return <span className="text-primary">신규 발생</span>;
  if (change === 0) return <span className="text-outline">변화 없음</span>;
  const increased = change > 0;
  return (
    <span className={increased ? "text-primary" : "text-error"}>
      {increased ? "+" : ""}{change.toFixed(Math.abs(change) >= 10 ? 0 : 1)}%
    </span>
  );
}

function Metric({
  label,
  value,
  current,
  previous,
  icon,
}: {
  label: string;
  value: string;
  current: number;
  previous: number;
  icon: string;
}) {
  return (
    <div className="min-w-0 py-2">
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-outline">
        <span className="material-symbols-outlined text-base text-primary">{icon}</span>
        {label}
      </div>
      <p className="mt-1 truncate font-headline text-2xl font-extrabold tracking-tight text-on-surface">{value}</p>
      <p className="mt-1 text-[11px] font-semibold"><ChangeLabel current={current} previous={previous} /> <span className="font-normal text-outline">이전 기간 대비</span></p>
    </div>
  );
}

function TrendChart({ data }: { data: DashboardData["daily"] }) {
  const max = Math.max(1, ...data.map((day) => Math.max(day.page_views, day.visitors)));
  const labelEvery = data.length > 31 ? 14 : data.length > 14 ? 7 : 1;

  return (
    <div>
      <div className="mb-4 flex items-center gap-4 text-[11px] font-semibold text-outline">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" />방문자</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-on-surface/25" />페이지뷰</span>
      </div>
      <div className="flex h-52 items-end gap-1" role="img" aria-label="기간별 방문자와 페이지뷰 막대 차트">
        {data.map((day, index) => {
          const pageHeight = Math.max(day.page_views > 0 ? 3 : 0, (day.page_views / max) * 100);
          const visitorHeight = Math.max(day.visitors > 0 ? 3 : 0, (day.visitors / max) * 100);
          const date = new Date(`${day.date}T00:00:00+09:00`);
          return (
            <div key={day.date} className="group relative flex h-full min-w-0 flex-1 items-end justify-center" title={`${day.date} · 방문자 ${day.visitors} · 페이지뷰 ${day.page_views}`}>
              <div className="absolute bottom-0 w-full max-w-5 rounded-t bg-on-surface/10 transition-colors group-hover:bg-on-surface/20" style={{ height: `${pageHeight}%` }} />
              <div className="absolute bottom-0 w-[42%] max-w-2 rounded-t bg-primary transition-colors group-hover:bg-primary-highlight" style={{ height: `${visitorHeight}%` }} />
              {(index % labelEvery === 0 || index === data.length - 1) && (
                <span className="absolute -bottom-5 whitespace-nowrap text-[9px] text-outline">
                  {date.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AudienceRow({ label, value, total }: { label: string; value: number; total: number }) {
  const rate = analyticsRate(value, total);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-on-surface-variant">{label}</span>
        <span className="font-bold text-on-surface">{numberFormatter.format(value)} <span className="font-normal text-outline">({rate.toFixed(0)}%)</span></span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-high">
        <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${rate}%` }} />
      </div>
    </div>
  );
}

function FunnelRow({ label, value, visitors }: { label: string; value: number; visitors: number }) {
  const rate = analyticsRate(value, visitors);
  return (
    <div className="grid grid-cols-[92px_1fr_auto] items-center gap-3 py-2.5">
      <span className="text-xs font-bold text-on-surface-variant">{label}</span>
      <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
        <div className="h-full rounded-full bg-primary" style={{ width: `${rate}%` }} />
      </div>
      <span className="w-20 text-right text-xs font-bold text-on-surface">{numberFormatter.format(value)} <span className="font-normal text-outline">{rate.toFixed(0)}%</span></span>
    </div>
  );
}

function RankedList({
  title,
  description,
  empty,
  items,
}: {
  title: string;
  description: string;
  empty: string;
  items: Array<{ key: string; label: string; meta?: string; value: number }>;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <AdminListSurface>
      <div className="border-b border-outline-variant/25 px-5 py-4">
        <h2 className="font-headline text-base font-extrabold text-on-surface">{title}</h2>
        <p className="mt-1 text-xs text-outline">{description}</p>
      </div>
      {items.length === 0 ? (
        <p className="px-5 py-8 text-sm text-on-surface-variant">{empty}</p>
      ) : (
        <ol className="divide-y divide-outline-variant/20 px-5">
          {items.map((item, index) => (
            <li key={item.key} className="relative py-3">
              <div className="absolute bottom-0 left-0 h-px bg-primary/35" style={{ width: `${(item.value / max) * 100}%` }} />
              <div className="flex items-center gap-3">
                <span className="w-4 shrink-0 text-[11px] font-black text-primary">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-on-surface">{item.label}</p>
                  {item.meta && <p className="mt-0.5 truncate text-[11px] text-outline">{item.meta}</p>}
                </div>
                <span className="shrink-0 text-xs font-bold text-on-surface">{numberFormatter.format(item.value)}회</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </AdminListSurface>
  );
}

export default function AdminAnalyticsDashboard() {
  const [range, setRange] = useState<AdminAnalyticsRange>(7);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (days: AdminAnalyticsRange, silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await fetch(`/api/admin/analytics?days=${days}`, { cache: "no-store" });
      if (response.status === 403) {
        setForbidden(true);
        return;
      }
      const body = await response.json().catch(() => null) as { analytics?: DashboardData; error?: string } | null;
      if (!response.ok || !body?.analytics) throw new Error(body?.error || "분석 데이터를 불러오지 못했습니다.");
      setData(body.analytics);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "분석 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(range);
  }, [load, range]);

  const topPages = useMemo(() => data?.topPages.map((item) => ({ key: item.path, label: item.path, value: item.views })) ?? [], [data]);
  const topImages = useMemo(() => data?.topImages.map((item) => ({ key: item.id, label: item.title, meta: item.asset_id ?? undefined, value: item.views })) ?? [], [data]);
  const topSearches = useMemo(() => data?.topSearches.map((item) => ({ key: item.query, label: item.query, value: item.searches })) ?? [], [data]);
  const zeroSearches = useMemo(() => data?.zeroResultSearches.map((item) => ({ key: item.query, label: item.query, value: item.searches })) ?? [], [data]);

  if (forbidden) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-10 text-outline">
        <span className="material-symbols-outlined text-6xl text-error">lock</span>
        <h1 className="font-headline text-xl font-extrabold text-on-surface">접근 권한이 없습니다</h1>
        <p className="text-sm">관리자 계정이 아닙니다.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] p-4 md:p-8 lg:p-10">
      <header className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <AdminChip tone="primary">운영 요약</AdminChip>
            <AdminChip tone="neutral">KST 기준</AdminChip>
          </div>
          <h1 className="mt-3 font-headline text-2xl font-extrabold tracking-tight text-on-surface">분석 대시보드</h1>
          <p className="mt-1 text-sm text-outline">방문부터 검색·주문까지, 의사결정에 필요한 흐름만 봅니다.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="https://dash.cloudflare.com/?to=/:account/web-analytics"
            target="_blank"
            rel="noreferrer"
            className="ui-interactive inline-flex h-10 items-center gap-1.5 rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-4 text-xs font-bold text-on-surface-variant hover:-translate-y-px hover:border-primary/50 hover:text-primary"
          >
            <span className="material-symbols-outlined text-base">monitoring</span>
            Cloudflare 방문 분석
          </a>
          <AdminButton onClick={() => void load(range, true)} disabled={refreshing} size="md">
            <span className={cn("material-symbols-outlined text-base", refreshing && "animate-spin")}>refresh</span>
            새로고침
          </AdminButton>
        </div>
      </header>

      <div className="mb-6 flex w-fit gap-1 rounded-lg bg-surface-container-lowest p-1 shadow-ghost" aria-label="분석 기간">
        {ADMIN_ANALYTICS_RANGES.map((days) => (
          <button
            key={days}
            type="button"
            onClick={() => setRange(days)}
            className={cn(
              "ui-interactive h-9 rounded-lg px-4 text-xs font-bold",
              range === days ? "bg-primary text-white shadow-sm" : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
            )}
            aria-pressed={range === days}
          >
            {days}일
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-error/20 bg-error/5 px-4 py-3 text-xs font-semibold text-error">
          <span>{error}</span>
          <button type="button" onClick={() => void load(range)} className="shrink-0 underline">다시 시도</button>
        </div>
      )}

      {loading && !data ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : data ? (
        <div className="space-y-6">
          <AdminListSurface className="p-5">
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <Metric label="순 방문자" value={numberFormatter.format(data.summary.visitors)} current={data.summary.visitors} previous={data.previous.visitors} icon="group" />
              <Metric label="페이지뷰" value={numberFormatter.format(data.summary.pageViews)} current={data.summary.pageViews} previous={data.previous.pageViews} icon="visibility" />
              <Metric label="검색" value={numberFormatter.format(data.summary.searches)} current={data.summary.searches} previous={data.previous.searches} icon="search" />
              <Metric label="신규 회원" value={numberFormatter.format(data.summary.newMembers)} current={data.summary.newMembers} previous={data.previous.newMembers} icon="person_add" />
              <Metric label="완료 주문" value={numberFormatter.format(data.summary.completedOrders)} current={data.summary.completedOrders} previous={data.previous.completedOrders} icon="receipt_long" />
              <Metric label="매출" value={currencyFormatter.format(data.summary.revenue)} current={data.summary.revenue} previous={data.previous.revenue} icon="payments" />
            </div>
            <AdminInlineMetrics
              className="mt-4 border-t border-outline-variant/25 pt-4"
              items={[
                { label: "세션", value: numberFormatter.format(data.summary.sessions) },
                { label: "이미지 열람", value: numberFormatter.format(data.summary.imageViews) },
                { label: "다운로드", value: numberFormatter.format(data.summary.downloads) },
                { label: "필터", value: "봇·관리자·개발환경 제외" },
              ]}
            />
          </AdminListSurface>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.75fr)]">
            <AdminListSurface className="p-5 pb-8">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-headline text-base font-extrabold text-on-surface">방문 추세</h2>
                  <p className="mt-1 text-xs text-outline">하루 단위 순 방문자와 페이지뷰</p>
                </div>
                <AdminChip tone="neutral">최근 {data.range.days}일</AdminChip>
              </div>
              <TrendChart data={data.daily} />
            </AdminListSurface>

            <AdminListSurface className="p-5">
              <h2 className="font-headline text-base font-extrabold text-on-surface">방문자 구성</h2>
              <p className="mt-1 text-xs text-outline">중복 방문을 제거한 기간 내 방문자 기준</p>
              <div className="mt-5 space-y-4">
                <AudienceRow label="비회원" value={data.audience.guests} total={data.summary.visitors} />
                <AudienceRow label="로그인 회원" value={data.audience.logged_in} total={data.summary.visitors} />
                <AudienceRow label="신규 방문" value={data.audience.new_visitors} total={data.summary.visitors} />
                <AudienceRow label="재방문" value={data.audience.returning_visitors} total={data.summary.visitors} />
                <AudienceRow label="모바일" value={data.audience.mobile} total={data.summary.visitors} />
                <AudienceRow label="데스크톱" value={data.audience.desktop} total={data.summary.visitors} />
              </div>
            </AdminListSurface>
          </div>

          <AdminListSurface className="p-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <h2 className="font-headline text-base font-extrabold text-on-surface">이용 전환 흐름</h2>
                <p className="mt-1 text-xs text-outline">전체 방문자를 기준으로 각 행동을 한 순 방문자 비율</p>
              </div>
              <Link href="/admin/activity" className="text-xs font-bold text-primary hover:text-primary-highlight">원시 활동 로그 보기 →</Link>
            </div>
            <div className="mt-4 divide-y divide-outline-variant/20">
              <FunnelRow label="전체 방문" value={data.funnel.visitors} visitors={data.funnel.visitors} />
              <FunnelRow label="이미지 열람" value={data.funnel.imageViewers} visitors={data.funnel.visitors} />
              <FunnelRow label="장바구니" value={data.funnel.cartUsers} visitors={data.funnel.visitors} />
              <FunnelRow label="결제 시작" value={data.funnel.checkoutUsers} visitors={data.funnel.visitors} />
              <FunnelRow label="주문 완료" value={data.funnel.purchasers} visitors={data.funnel.visitors} />
            </div>
          </AdminListSurface>

          <div className="grid gap-6 lg:grid-cols-2">
            <RankedList title="인기 페이지" description="페이지뷰가 가장 많은 경로" empty="이 기간에는 페이지 조회 기록이 없습니다." items={topPages} />
            <RankedList title="인기 이미지" description="상세 열람이 가장 많은 이미지" empty="이 기간에는 이미지 열람 기록이 없습니다." items={topImages} />
            <RankedList title="많이 찾은 검색어" description="고객 수요를 보여주는 실제 검색어" empty="이 기간에는 검색 기록이 없습니다." items={topSearches} />
            <RankedList title="결과 없는 검색어" description="태그 보강이나 이미지 수급이 필요한 검색어" empty="결과 없는 검색어가 없습니다." items={zeroSearches} />
          </div>

          <div className="flex flex-col justify-between gap-3 rounded-lg border border-outline-variant/25 bg-surface-container-low px-4 py-3 text-xs text-on-surface-variant sm:flex-row sm:items-center">
            <span>Cloudflare는 전체 방문량과 웹 성능의 교차 확인용이며, 주문·검색·다운로드 지표는 이 대시보드의 Supabase 기록이 기준입니다.</span>
            <Link href="/admin/stats" className="shrink-0 font-bold text-primary hover:text-primary-highlight">누적 통계 보기 →</Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
