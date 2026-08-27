"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { useAuth } from "@/lib/store/auth";
import {
  ADMIN_NAV_GROUPS,
  ADMIN_NAV_PRIMARY_ITEMS,
  type AdminPendingCountKey,
  adminNavGroupIsActive,
  adminNavItemIsActive,
  defaultOpenAdminGroups,
} from "@/lib/admin/nav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, init, signOut } = useAuth();
  const [openGroupIds, setOpenGroupIds] = useState<string[]>(() => defaultOpenAdminGroups(ADMIN_NAV_GROUPS, pathname));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingCounts, setPendingCounts] = useState<Record<AdminPendingCountKey, number>>({
    general: 0,
    photo: 0,
    payment: 0,
  });
  const visibleOpenGroupIds = useMemo(() => {
    const activeGroups = defaultOpenAdminGroups(ADMIN_NAV_GROUPS, pathname);
    return Array.from(new Set([...openGroupIds, ...activeGroups]));
  }, [openGroupIds, pathname]);

  useEffect(() => { init(); }, [init]);
  useEffect(() => {
    let active = true;
    const loadCounts = () => fetch("/api/admin/support/counts")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (active && data) setPendingCounts({
          general: data.general ?? 0,
          photo: data.photo ?? 0,
          payment: data.payment ?? 0,
        });
      })
      .catch(() => {});
    loadCounts();
    const refreshOnFocus = () => loadCounts();
    window.addEventListener("focus", refreshOnFocus);
    const timer = window.setInterval(loadCounts, 30_000);
    return () => {
      active = false;
      window.removeEventListener("focus", refreshOnFocus);
      window.clearInterval(timer);
    };
  }, [pathname]);

  function toggleGroup(groupId: string) {
    setOpenGroupIds((current) => (
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId]
    ));
  }

  function renderNavGroups(mode: "desktop" | "mobile") {
    return ADMIN_NAV_GROUPS.map((group) => {
      const groupOpen = visibleOpenGroupIds.includes(group.id);
      const groupActive = adminNavGroupIsActive(group, pathname);
      return (
        <section key={group.id} className={mode === "desktop" ? "rounded-lg" : "border-b border-outline-variant/20 last:border-b-0"}>
          <button
            type="button"
            onClick={() => toggleGroup(group.id)}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-bold transition-colors",
              groupActive ? "bg-primary/10 text-primary" : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
              mode === "mobile" && "rounded-none py-3",
            )}
            aria-expanded={groupOpen}
          >
            <span className="material-symbols-outlined text-lg">{group.icon}</span>
            <span className="min-w-0 flex-1 truncate">{group.label}</span>
            <span className="material-symbols-outlined text-lg">{groupOpen ? "expand_less" : "expand_more"}</span>
          </button>
          {groupOpen && (
            <div className={cn("grid gap-1", mode === "desktop" ? "mt-1 pl-2" : "px-3 pb-3")}>
              {group.items.map(({ href, icon, label }) => {
                const isActive = adminNavItemIsActive(href, pathname);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
                    )}
                  >
                    <span className="material-symbols-outlined text-lg">{icon}</span>
                    <span className="truncate">{label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      );
    });
  }

  function renderPrimaryItems(mode: "desktop" | "mobile") {
    return ADMIN_NAV_PRIMARY_ITEMS.map(({ href, icon, label, countKey }) => {
      const isActive = adminNavItemIsActive(href, pathname);
      const count = countKey ? pendingCounts[countKey] : 0;
      return (
        <Link
          key={href}
          href={href}
          onClick={() => setMobileMenuOpen(false)}
          className={cn(
            "flex items-center gap-2 px-3 py-2.5 text-sm font-bold transition-colors",
            mode === "desktop" ? "rounded-lg" : "border-b border-outline-variant/20",
            isActive ? "bg-primary/10 text-primary" : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
          )}
        >
          <span className="material-symbols-outlined text-lg">{icon}</span>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {count > 0 && (
            <span className="min-w-5 rounded-full bg-error px-1.5 py-0.5 text-center text-[10px] font-black text-white" aria-label={`신규 ${count}건`}>
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Link>
      );
    });
  }

  return (
    <div className="min-h-screen flex bg-surface-container-low">

      {/* ── Sidebar ── */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 bg-surface-container-lowest shadow-ghost">
        {/* Brand */}
        <div className="px-6 py-6 border-b border-outline-variant/20">
          <Link href="/" className="text-sm font-headline font-black uppercase text-on-surface hover:text-primary transition-colors">
            IMAGE PARTNERS
          </Link>
          <p className="text-[10px] font-semibold text-primary mt-1">Admin</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
          {renderPrimaryItems("desktop")}
          <div className="my-2 border-t border-outline-variant/20" />
          {renderNavGroups("desktop")}
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
              <p className="text-xs font-semibold text-on-surface truncate">{user?.full_name || "Admin"}</p>
              <p className="text-[10px] text-outline truncate">{user?.email || ""}</p>
            </div>
            <button onClick={user ? signOut : undefined} aria-label="로그아웃">
              <span className="material-symbols-outlined text-base text-outline hover:text-on-surface transition-colors cursor-pointer">logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-4 bg-surface-container-lowest border-b border-outline-variant/20">
          <div>
            <Link href="/" className="text-sm font-headline font-black uppercase text-on-surface">
              IMAGE PARTNERS
            </Link>
            <span className="ml-2 text-[10px] font-semibold text-primary">Admin</span>
          </div>
        </div>
        {/* Mobile accordion nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-container-lowest border-t border-outline-variant/20 shadow-ghost">
          {mobileMenuOpen && (
            <div className="max-h-[70vh] overflow-y-auto border-b border-outline-variant/20">
              {renderPrimaryItems("mobile")}
              {renderNavGroups("mobile")}
            </div>
          )}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="flex w-full items-center justify-center gap-2 px-4 py-3 text-xs font-bold text-on-surface"
            aria-expanded={mobileMenuOpen}
          >
            <span className="material-symbols-outlined text-xl">{mobileMenuOpen ? "close" : "menu"}</span>
            관리자 메뉴
            <span className="material-symbols-outlined text-xl">{mobileMenuOpen ? "expand_more" : "expand_less"}</span>
          </button>
        </nav>

        <div className="flex-1 pb-20 md:pb-0">
          {children}
        </div>
      </main>
    </div>
  );
}
