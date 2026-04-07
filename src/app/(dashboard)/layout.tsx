"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils/cn";
import { useLang } from "@/lib/i18n/store";
import { useAuth } from "@/lib/store/auth";

const NAV_ITEMS_BUYER = [
  { href: "/dashboard",           icon: "grid_view",        key: "overview"   },
  { href: "/dashboard/favorites", icon: "favorite",         key: "favorites"  },
  { href: "/dashboard/orders",    icon: "receipt_long",     key: "orders"     },
  { href: "/dashboard/settings",  icon: "settings",         key: "settings"   },
];

const NAV_ITEMS_PHOTOGRAPHER = [
  { href: "/dashboard",           icon: "grid_view",        key: "overview"   },
  { href: "/dashboard/uploads",   icon: "cloud_upload",     key: "uploads"    },
  { href: "/dashboard/earnings",  icon: "payments",         key: "earnings"   },
  { href: "/dashboard/settings",  icon: "settings",         key: "settings"   },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { t } = useLang();
  const d = t.dashboard;
  const pathname  = usePathname();
  const { user, init, signOut } = useAuth();

  useEffect(() => { init(); }, [init]);

  // Fall back to demo toggle if not authenticated yet
  const [demoRole, setDemoRole] = useState<"buyer" | "photographer">("buyer");
  const role = user?.role ?? demoRole;
  const navItems = role === "buyer" ? NAV_ITEMS_BUYER : NAV_ITEMS_PHOTOGRAPHER;

  return (
    <div className="min-h-screen flex bg-surface-container-low">

      {/* ── Sidebar ── */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-surface-container-lowest shadow-ghost">
        {/* Brand */}
        <div className="px-6 py-6 border-b border-outline-variant/20">
          <Link href="/" className="text-sm font-headline font-black uppercase tracking-tighter text-on-surface hover:text-primary transition-colors">
            IMAGE PARTNERS
          </Link>
        </div>

        {/* Role indicator (or toggle in demo mode) */}
        <div className="px-4 py-4 border-b border-outline-variant/20">
          {user ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-container-low">
              <span className="material-symbols-outlined text-base text-primary">
                {user.role === "photographer" ? "photo_camera" : "shopping_bag"}
              </span>
              <span className="text-xs font-bold text-on-surface capitalize">{d.role[user.role]}</span>
            </div>
          ) : (
            <div className="flex rounded-lg overflow-hidden bg-surface-container-low p-1 gap-1">
              {(["buyer", "photographer"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setDemoRole(r)}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-bold rounded-md transition-all duration-200",
                    demoRole === r
                      ? "bg-primary text-white"
                      : "text-on-surface-variant hover:text-on-surface"
                  )}
                >
                  {d.role[r]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 flex flex-col gap-1">
          {navItems.map(({ href, icon, key }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                )}
              >
                <span className="material-symbols-outlined text-xl">{icon}</span>
                {d.nav[key as keyof typeof d.nav]}
              </Link>
            );
          })}
        </nav>

        {/* User info */}
        <div className="px-4 py-4 border-t border-outline-variant/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center shrink-0 overflow-hidden">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-base text-on-primary-container">person</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-on-surface truncate">{user?.full_name || "Demo User"}</p>
              <p className="text-[10px] text-outline truncate">{user?.email || "demo@imageptns.com"}</p>
            </div>
            <button onClick={user ? signOut : undefined}>
              <span className="material-symbols-outlined text-base text-outline hover:text-on-surface transition-colors cursor-pointer">logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-4 bg-surface-container-lowest border-b border-outline-variant/20">
          <Link href="/" className="text-sm font-headline font-black uppercase tracking-tighter text-on-surface">
            IMAGE PARTNERS
          </Link>
          {!user && (
            <div className="flex rounded-lg overflow-hidden bg-surface-container-low p-0.5 gap-0.5">
              {(["buyer", "photographer"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setDemoRole(r)}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-md transition-all",
                    demoRole === r ? "bg-primary text-white" : "text-on-surface-variant"
                  )}
                >
                  {d.role[r]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex bg-surface-container-lowest border-t border-outline-variant/20">
          {navItems.map(({ href, icon, key }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex-1 flex flex-col items-center py-3 gap-1 text-[10px] font-bold transition-colors",
                  isActive ? "text-primary" : "text-on-surface-variant"
                )}
              >
                <span className="material-symbols-outlined text-xl">{icon}</span>
                {d.nav[key as keyof typeof d.nav]}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1 pb-20 md:pb-0">
          {children}
        </div>
      </main>
    </div>
  );
}
