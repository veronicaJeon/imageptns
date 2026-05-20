"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils/cn";
import { useLang } from "@/lib/i18n/store";
import { useAuth } from "@/lib/store/auth";
import type { AuthUser } from "@/lib/store/auth";

type NavItem = { href: string; icon: string; key: string; label?: string };

const NAV_ITEMS_BUYER: NavItem[] = [
  { href: "/dashboard",           icon: "grid_view",        key: "overview"   },
  { href: "/dashboard/favorites", icon: "favorite",         key: "favorites"  },
  { href: "/dashboard/orders",    icon: "receipt_long",     key: "orders"     },
  { href: "/dashboard/settings",  icon: "settings",         key: "settings"   },
];

const NAV_ITEMS_PHOTOGRAPHER: NavItem[] = [
  { href: "/dashboard",           icon: "grid_view",        key: "overview"   },
  { href: "/dashboard/uploads",   icon: "cloud_upload",     key: "uploads"    },
  { href: "/dashboard/requests",  icon: "assignment",       key: "requests", label: "사진 의뢰" },
  { href: "/dashboard/blockchain", icon: "verified",         key: "blockchain" },
  { href: "/dashboard/earnings",  icon: "payments",         key: "earnings"   },
  { href: "/dashboard/settings",  icon: "settings",         key: "settings"   },
];

type DashboardUser = AuthUser | null;
type DashboardMode = "buyer" | "photographer";

function RoleSection({
  loading,
  user,
  role,
  demoRole,
  viewMode,
  roleLabels,
  onDemoRoleChange,
  onViewModeChange,
}: {
  loading: boolean;
  user: DashboardUser;
  role: string;
  demoRole: DashboardMode;
  viewMode: DashboardMode;
  roleLabels: Record<DashboardMode, string>;
  onDemoRoleChange: (role: DashboardMode) => void;
  onViewModeChange: (mode: DashboardMode) => void;
}) {
  if (loading) {
    return <div className="h-9 rounded-lg bg-surface-container-low animate-pulse" />;
  }

  if (!user) {
    return (
      <div className="flex rounded-lg overflow-hidden bg-surface-container-low p-1 gap-1">
        {(["buyer", "photographer"] as const).map((r) => (
          <button
            key={r}
            onClick={() => onDemoRoleChange(r)}
            className={cn(
              "flex-1 py-1.5 text-xs font-bold rounded-md transition-all duration-200",
              demoRole === r
                ? "bg-primary text-white"
                : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            {roleLabels[r]}
          </button>
        ))}
      </div>
    );
  }

  if (role === "photographer") {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex rounded-lg overflow-hidden bg-surface-container-low p-1 gap-1">
          <button
            onClick={() => onViewModeChange("photographer")}
            className={cn(
              "flex-1 py-1.5 text-xs font-bold rounded-md transition-all duration-200",
              viewMode === "photographer"
                ? "bg-primary text-white"
                : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            {roleLabels.photographer}
          </button>
          <button
            onClick={() => onViewModeChange("buyer")}
            className={cn(
              "flex-1 py-1.5 text-xs font-bold rounded-md transition-all duration-200",
              viewMode === "buyer"
                ? "bg-primary text-white"
                : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            {roleLabels.buyer}
          </button>
        </div>
        {user.is_admin && (
          <span className="text-[9px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded text-center">Admin</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-container-low">
      <span className="material-symbols-outlined text-base text-primary">shopping_bag</span>
      <span className="text-xs font-bold text-on-surface capitalize">{roleLabels.buyer}</span>
      {user.is_admin && (
        <span className="ml-auto text-[9px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded">Admin</span>
      )}
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { t } = useLang();
  const d = t.dashboard;
  const pathname  = usePathname();
  const { user, loading, init, signOut } = useAuth();

  // Demo toggle only shown when truly not authenticated (not during loading)
  const [demoRole, setDemoRole] = useState<DashboardMode>("buyer");
  // viewMode: photographers can switch to buyer nav without changing their DB role
  const [viewModeOverride, setViewModeOverride] = useState<DashboardMode | null>(null);

  useEffect(() => { init(); }, [init]);

  const role = user?.role ?? demoRole;
  const viewMode: DashboardMode = user
    ? role === "photographer"
      ? viewModeOverride ?? "photographer"
      : "buyer"
    : demoRole;
  const effectiveMode = user ? viewMode : demoRole;
  const navItems = effectiveMode === "photographer" ? NAV_ITEMS_PHOTOGRAPHER : NAV_ITEMS_BUYER;

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

        {/* Role indicator / toggle */}
        <div className="px-4 py-4 border-b border-outline-variant/20">
          <RoleSection
            loading={loading}
            user={user}
            role={role}
            demoRole={demoRole}
            viewMode={viewMode}
            roleLabels={d.role}
            onDemoRoleChange={setDemoRole}
            onViewModeChange={setViewModeOverride}
          />
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 flex flex-col gap-1">
          {navItems.map(({ href, icon, key, label }) => {
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
                {label ?? d.nav[key as keyof typeof d.nav]}
              </Link>
            );
          })}
        </nav>

        {/* User info */}
        <div className="px-4 py-4 border-t border-outline-variant/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center shrink-0 overflow-hidden">
              {user?.avatar_url ? (
                <Image src={user.avatar_url} alt="" width={32} height={32} className="w-full h-full object-cover" />
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
          {user?.role === "photographer" ? (
            <div className="flex rounded-lg overflow-hidden bg-surface-container-low p-0.5 gap-0.5">
              {(["photographer", "buyer"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setViewModeOverride(r)}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-md transition-all",
                    viewMode === r ? "bg-primary text-white" : "text-on-surface-variant"
                  )}
                >
                  {d.role[r]}
                </button>
              ))}
            </div>
          ) : !user ? (
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
          ) : null}
        </div>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex bg-surface-container-lowest border-t border-outline-variant/20">
          {navItems.map(({ href, icon, key, label }) => {
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
                {label ?? d.nav[key as keyof typeof d.nav]}
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
