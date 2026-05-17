"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLang } from "@/lib/i18n/store";
import { useAuth } from "@/lib/store/auth";
import { useCart } from "@/lib/store/cart";

function StatCard({ icon, label, value, color, href }: { icon: string; label: string; value: string; color: string; href?: string }) {
  const content = (
    <div className={`bg-surface-container-lowest p-6 shadow-ghost flex flex-col gap-3 ${href ? "hover:bg-surface-container-low transition-colors cursor-pointer" : ""}`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color}`}>
        <span className="material-symbols-outlined text-xl">{icon}</span>
      </div>
      <p className="text-2xl font-headline font-extrabold text-on-surface">{value}</p>
      <p className="text-xs text-outline uppercase tracking-widest font-bold">{label}</p>
    </div>
  );
  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

const ACTION_STYLE: Record<string, string> = {
  Licensed:       "bg-primary/10 text-primary",
  Approved:       "bg-primary/10 text-primary",
  "Under Review": "bg-amber-50 text-amber-500 dark:bg-amber-900/20 dark:text-amber-300",
  Rejected:       "bg-error/10 text-error",
  Draft:          "bg-surface-container-high text-outline",
};

export default function DashboardPage() {
  const { t } = useLang();
  const d = t.dashboard.overview;
  const { user, init } = useAuth();
  const cartCount = useCart((s) => s.items.length);

  const [stats, setStats]   = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const role = stats?.role ?? user?.role ?? "buyer";
  const greeting = user?.full_name ? `${d.greeting}, ${user.full_name.split(" ")[0]}` : d.greeting;

  return (
    <div className="p-6 md:p-10 max-w-6xl">

      {/* ── Greeting ── */}
      <div className="mb-10">
        <h1 className="font-headline text-2xl md:text-3xl font-extrabold text-on-surface tracking-tight">
          {greeting} 👋
        </h1>
        <p className="text-on-surface-variant text-sm mt-1">Image Partners Dashboard</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : role === "buyer" ? (
        /* ── BUYER VIEW ── */
        <section>
          <p className="text-xs text-outline uppercase tracking-widest font-bold mb-4">Buyer Overview</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
            <StatCard icon="favorite"      label={d.statFavorites} value={String(stats?.favorites_count ?? 0)} color="bg-red-50 text-red-400 dark:bg-red-900/20"   href="/dashboard/favorites" />
            <StatCard icon="receipt_long"  label={d.statOrders}    value={String(stats?.orders_count ?? 0)}    color="bg-blue-50 text-blue-400 dark:bg-blue-900/20" href="/dashboard/orders" />
            <StatCard icon="shopping_cart" label={d.statCart}      value={String(cartCount)}                    color="bg-primary/10 text-primary"                  href="/cart" />
          </div>

          <p className="text-xs text-outline uppercase tracking-widest font-bold mb-4">{d.recentTitle}</p>
          {(stats?.recent ?? []).length === 0 ? (
            <div className="bg-surface-container-lowest shadow-ghost p-8 flex flex-col items-center gap-3 text-outline">
              <span className="material-symbols-outlined text-4xl">receipt_long</span>
              <p className="text-sm">No recent activity</p>
            </div>
          ) : (
            <div className="bg-surface-container-lowest shadow-ghost overflow-hidden">
              {(stats?.recent ?? []).map((item: any, i: number, arr: any[]) => (
                <div key={i} className={`flex items-center gap-4 px-6 py-4 ${i < arr.length - 1 ? "border-b border-outline-variant/20" : ""}`}>
                  <div className="w-15 h-10 bg-surface-container-low rounded shrink-0 overflow-hidden flex items-center justify-center" style={{ width: 60, height: 40 }}>
                    {item.src ? (
                      <img src={item.src} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-outline text-sm">image</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-on-surface truncate">{item.title}</p>
                    <p className="text-xs text-outline">{item.date}</p>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${ACTION_STYLE[item.action] ?? "bg-surface-container-high text-on-surface-variant"}`}>
                    {item.action}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6">
            <Link href="/library" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity">
              <span className="material-symbols-outlined text-base">photo_library</span>
              {d.browseBtn}
            </Link>
          </div>
        </section>
      ) : (
        /* ── PHOTOGRAPHER VIEW ── */
        <section>
          <p className="text-xs text-outline uppercase tracking-widest font-bold mb-4">Photographer Overview</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
            <StatCard icon="cloud_upload" label={d.statUploads}  value={String(stats?.uploads_count ?? 0)}                                          color="bg-primary/10 text-primary" />
            <StatCard icon="payments"     label={d.statEarnings} value={`₩${(stats?.earnings_total ?? 0).toLocaleString("ko-KR")}`}                color="bg-green-50 text-green-500 dark:bg-green-900/20" />
            <StatCard icon="pending"      label={d.statPending}  value={String(stats?.pending_review_count ?? 0)}                                    color="bg-amber-50 text-amber-400 dark:bg-amber-900/20" />
          </div>

          <p className="text-xs text-outline uppercase tracking-widest font-bold mb-4">{d.recentTitle}</p>
          {(stats?.recent ?? []).length === 0 ? (
            <div className="bg-surface-container-lowest shadow-ghost p-8 flex flex-col items-center gap-3 text-outline">
              <span className="material-symbols-outlined text-4xl">cloud_upload</span>
              <p className="text-sm">No uploads yet</p>
            </div>
          ) : (
            <div className="bg-surface-container-lowest shadow-ghost overflow-hidden">
              {(stats?.recent ?? []).map((item: any, i: number, arr: any[]) => (
                <div key={i} className={`flex items-center gap-4 px-6 py-4 ${i < arr.length - 1 ? "border-b border-outline-variant/20" : ""}`}>
                  <div className="bg-surface-container-low rounded shrink-0 overflow-hidden flex items-center justify-center" style={{ width: 60, height: 40 }}>
                    {item.src ? (
                      <img src={item.src} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-outline text-sm">image</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-on-surface truncate">{item.title}</p>
                    <p className="text-xs text-outline">{item.date}</p>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${ACTION_STYLE[item.action] ?? "bg-amber-50 text-amber-400"}`}>
                    {item.action}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6">
            <Link href="/dashboard/uploads" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity">
              <span className="material-symbols-outlined text-base">cloud_upload</span>
              {d.uploadBtn}
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
