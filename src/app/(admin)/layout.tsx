"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/utils/cn";
import { useAuth } from "@/lib/store/auth";

const NAV_ITEMS = [
  { href: "/admin",                   icon: "pending_actions", label: "이미지 검토"   },
  { href: "/admin/onchain",           icon: "account_balance",  label: "온체인 운영"  },
  { href: "/admin/payouts",           icon: "payments",        label: "정산 관리"    },
  { href: "/admin/pricing",           icon: "sell",            label: "상품 가격"    },
  { href: "/admin/commission",        icon: "percent",         label: "수수료 정책"  },
  { href: "/admin/support",           icon: "support_agent",   label: "고객 문의"    },
  { href: "/admin/activity",          icon: "timeline",        label: "방문 로그"    },
  { href: "/admin/audit",             icon: "policy",          label: "감사 로그"    },
  { href: "/admin/stats",             icon: "bar_chart",       label: "통계"         },
  { href: "/admin/image-insights",    icon: "insights",        label: "이미지 인사이트" },
  { href: "/admin/notices",           icon: "campaign",        label: "공지사항"      },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, init, signOut } = useAuth();

  useEffect(() => { init(); }, [init]);

  return (
    <div className="min-h-screen flex bg-surface-container-low">

      {/* ── Sidebar ── */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 bg-surface-container-lowest shadow-ghost">
        {/* Brand */}
        <div className="px-6 py-6 border-b border-outline-variant/20">
          <Link href="/" className="text-sm font-headline font-black uppercase tracking-tighter text-on-surface hover:text-primary transition-colors">
            IMAGE PARTNERS
          </Link>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary mt-1">Admin</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 flex flex-col gap-1">
          {NAV_ITEMS.map(({ href, icon, label }) => {
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
                {label}
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
            <Link href="/" className="text-sm font-headline font-black uppercase tracking-tighter text-on-surface">
              IMAGE PARTNERS
            </Link>
            <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-primary">Admin</span>
          </div>
        </div>
        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex bg-surface-container-lowest border-t border-outline-variant/20">
          {NAV_ITEMS.map(({ href, icon, label }) => {
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
                {label}
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
