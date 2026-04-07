"use client";

import Link from "next/link";
import Image from "next/image";
import { useLang } from "@/lib/i18n/store";

/* ── Mock recent activity ─────────────────────────── */
const BUYER_RECENT = [
  { id: "1", title: "Morning Mist Over Mountains", action: "Licensed", date: "Apr 4, 2026", src: "https://picsum.photos/seed/mist1/120/80" },
  { id: "2", title: "Tokyo at 3AM",                action: "Favorited", date: "Apr 3, 2026", src: "https://picsum.photos/seed/tokyo3/120/80" },
  { id: "3", title: "Brutalist Geometry",           action: "In Cart",   date: "Apr 1, 2026", src: "https://picsum.photos/seed/brutal5/120/80" },
];

const PHOTOGRAPHER_RECENT = [
  { id: "a", title: "Desert Dunes Series #4",  action: "Approved",       date: "Apr 5, 2026", src: "https://picsum.photos/seed/desert4/120/80" },
  { id: "b", title: "Urban Silence #11",       action: "Under Review",   date: "Apr 3, 2026", src: "https://picsum.photos/seed/urban11/120/80" },
  { id: "c", title: "Glacial Lake — Patagonia",action: "Sold ×3",        date: "Apr 1, 2026", src: "https://picsum.photos/seed/glacier13/120/80" },
];

/* ── Stat card ────────────────────────────────────── */
function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div className="bg-surface-container-lowest p-6 shadow-ghost flex flex-col gap-3">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color}`}>
        <span className="material-symbols-outlined text-xl">
          {icon}
        </span>
      </div>
      <p className="text-2xl font-headline font-extrabold text-on-surface">{value}</p>
      <p className="text-xs text-outline uppercase tracking-widest font-bold">{label}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useLang();
  const d = t.dashboard.overview;

  // In real app, role comes from auth context.
  // Here we read it from the layout's demo toggle via a simple approach:
  // We'll render both sections and let CSS/state handle it.
  // For simplicity, render both buyer & photographer sections
  // and let the user use the role toggle in the sidebar.
  // We'll detect the "active" role by checking localStorage or a simple hook.
  // For prototype: always show buyer view.

  return (
    <div className="p-6 md:p-10 max-w-6xl">

      {/* ── Greeting ── */}
      <div className="mb-10">
        <h1 className="font-headline text-2xl md:text-3xl font-extrabold text-on-surface tracking-tight">
          {d.greeting}, Demo. 👋
        </h1>
        <p className="text-on-surface-variant text-sm mt-1">Image Partners Dashboard</p>
      </div>

      {/* ── BUYER VIEW ── */}
      <section className="mb-12">
        <p className="text-xs text-outline uppercase tracking-widest font-bold mb-4">Buyer Overview</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
          <StatCard icon="favorite"     label={d.statFavorites} value="24"   color="bg-red-50 text-red-400 dark:bg-red-900/20" />
          <StatCard icon="receipt_long" label={d.statOrders}    value="11"   color="bg-blue-50 text-blue-400 dark:bg-blue-900/20" />
          <StatCard icon="shopping_cart"label={d.statCart}      value="3"    color="bg-primary/10 text-primary" />
        </div>

        {/* Recent */}
        <p className="text-xs text-outline uppercase tracking-widest font-bold mb-4">{d.recentTitle}</p>
        <div className="bg-surface-container-lowest shadow-ghost overflow-hidden">
          {BUYER_RECENT.map(({ id, title, action, date, src }, i) => (
            <div key={id} className={`flex items-center gap-4 px-6 py-4 ${i < BUYER_RECENT.length - 1 ? "border-b border-outline-variant/20" : ""}`}>
              <Image src={src} alt={title} width={60} height={40} className="object-cover shrink-0 rounded" unoptimized />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-on-surface truncate">{title}</p>
                <p className="text-xs text-outline">{date}</p>
              </div>
              <span className={[
                "text-xs font-bold px-3 py-1 rounded-full",
                action === "Licensed"  ? "bg-primary/10 text-primary" :
                action === "Favorited" ? "bg-red-50 text-red-400 dark:bg-red-900/20 dark:text-red-300" :
                "bg-surface-container-high text-on-surface-variant"
              ].join(" ")}>
                {action}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <Link
            href="/library"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-base">photo_library</span>
            {d.browseBtn}
          </Link>
        </div>
      </section>

      {/* ── PHOTOGRAPHER VIEW ── */}
      <section>
        <p className="text-xs text-outline uppercase tracking-widest font-bold mb-4">Photographer Overview</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
          <StatCard icon="cloud_upload" label={d.statUploads}  value="142"       color="bg-primary/10 text-primary" />
          <StatCard icon="payments"     label={d.statEarnings} value="₩1,240,000" color="bg-green-50 text-green-500 dark:bg-green-900/20" />
          <StatCard icon="pending"      label={d.statPending}  value="3"          color="bg-amber-50 text-amber-400 dark:bg-amber-900/20" />
        </div>

        <p className="text-xs text-outline uppercase tracking-widest font-bold mb-4">{d.recentTitle}</p>
        <div className="bg-surface-container-lowest shadow-ghost overflow-hidden">
          {PHOTOGRAPHER_RECENT.map(({ id, title, action, date, src }, i) => (
            <div key={id} className={`flex items-center gap-4 px-6 py-4 ${i < PHOTOGRAPHER_RECENT.length - 1 ? "border-b border-outline-variant/20" : ""}`}>
              <Image src={src} alt={title} width={60} height={40} className="object-cover shrink-0 rounded" unoptimized />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-on-surface truncate">{title}</p>
                <p className="text-xs text-outline">{date}</p>
              </div>
              <span className={[
                "text-xs font-bold px-3 py-1 rounded-full",
                action === "Approved"      ? "bg-primary/10 text-primary" :
                action.includes("Sold")    ? "bg-green-50 text-green-500 dark:bg-green-900/20 dark:text-green-300" :
                "bg-amber-50 text-amber-400 dark:bg-amber-900/20 dark:text-amber-300"
              ].join(" ")}>
                {action}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <button className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity">
            <span className="material-symbols-outlined text-base">cloud_upload</span>
            {d.uploadBtn}
          </button>
        </div>
      </section>
    </div>
  );
}
