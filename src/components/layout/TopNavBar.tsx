"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { useLang } from "@/lib/i18n/store";
import { useCart } from "@/lib/store/cart";
import { useAuth } from "@/lib/store/auth";

export function TopNavBar() {
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(false);
  const { lang, t, toggle } = useLang();
  const cartCount = useCart((s) => s.items.length);
  const { user, loading, init, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { init(); }, [init]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Restore dark mode
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    }
  }, []);

  function toggleDark() {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }

  const NAV_LINKS = [
    { href: "/library", label: t.nav.library },
    { href: "/",        label: t.nav.company },
    { href: "/support", label: t.nav.qa },
  ];

  return (
    <nav
      className={cn(
        "fixed top-0 w-full z-50 h-20 transition-all duration-300",
        isDark ? "glass-dark" : "glass"
      )}
    >
      <div className="flex justify-between items-center px-6 md:px-8 h-20 max-w-[1920px] mx-auto">

        {/* Brand */}
        <Link
          href="/"
          className="text-lg font-headline font-black uppercase tracking-tighter text-on-surface hover:text-primary transition-colors duration-200"
        >
          IMAGE PARTNERS
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-10">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "text-sm font-medium transition-all duration-200 pb-1",
                  isActive
                    ? "text-primary border-b-2 border-primary"
                    : "text-on-surface-variant hover:text-on-surface"
                )}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1 h-9">

          {/* Language toggle */}
          <button
            onClick={toggle}
            className="inline-flex items-center gap-1 h-9 px-3 rounded-lg text-xs font-bold tracking-widest text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all duration-200"
            aria-label="언어 변경"
          >
            <span className="material-symbols-outlined text-base leading-none">language</span>
            <span>{lang === "ko" ? "KO" : "EN"}</span>
          </button>

          {/* Dark mode toggle */}
          <button
            onClick={toggleDark}
            className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all duration-200"
            aria-label={isDark ? "라이트 모드" : "다크 모드"}
          >
            <span className="material-symbols-outlined text-xl leading-none">
              {isDark ? "light_mode" : "dark_mode"}
            </span>
          </button>

          {/* Cart */}
          <Link href="/cart" className="relative inline-flex items-center justify-center h-9 w-9 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all duration-200">
            <span className="material-symbols-outlined text-xl">shopping_cart</span>
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-white text-[9px] font-black flex items-center justify-center">
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            )}
          </Link>

          <div className="w-px h-5 bg-outline-variant/40 mx-1" />

          {/* Auth section */}
          {loading ? (
            // Skeleton while loading — prevents login flash
            <div className="w-24 h-8 rounded-lg bg-surface-container-low animate-pulse" />
          ) : user ? (
            // Logged in: user avatar + dropdown
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-container-high transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-primary-container flex items-center justify-center overflow-hidden shrink-0">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-sm text-on-primary-container">person</span>
                  )}
                </div>
                <span className="hidden md:block text-xs font-semibold text-on-surface max-w-[100px] truncate">
                  {user.full_name || user.email.split("@")[0]}
                </span>
                <span className="material-symbols-outlined text-base text-outline">expand_more</span>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-surface-container-lowest shadow-lg rounded-xl border border-outline-variant/20 py-1 z-50">
                  <div className="px-4 py-3 border-b border-outline-variant/20">
                    <p className="text-xs font-semibold text-on-surface truncate">{user.full_name || "—"}</p>
                    <p className="text-[10px] text-outline truncate">{user.email}</p>
                  </div>

                  <Link
                    href="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
                  >
                    <span className="material-symbols-outlined text-base text-outline">dashboard</span>
                    My Dashboard
                  </Link>

                  {user.is_admin && (
                    <Link
                      href="/admin"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-primary hover:bg-surface-container-low transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">admin_panel_settings</span>
                      Admin
                    </Link>
                  )}

                  <button
                    onClick={() => { setMenuOpen(false); signOut(); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
                  >
                    <span className="material-symbols-outlined text-base text-outline">logout</span>
                    로그아웃
                  </button>
                </div>
              )}
            </div>
          ) : (
            // Logged out: login + signup buttons
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">{t.nav.login}</Button>
              </Link>
              <Link href="/signup">
                <Button variant="primary" size="sm">{t.nav.signup}</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
