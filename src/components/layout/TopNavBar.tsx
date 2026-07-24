"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { useLang } from "@/lib/i18n/store";
import { useCart } from "@/lib/store/cart";
import { useAuth } from "@/lib/store/auth";

const TOP_NAV_COPY = {
  ko: {
    notices: "공지사항",
    language: "언어 변경",
    lightMode: "라이트 모드",
    darkMode: "다크 모드",
    mobileMenu: "모바일 메뉴",
    logout: "로그아웃",
    photoRequest: "사진요청",
    photoRequestHint: "원하는 이미지가 없다면?",
  },
  en: {
    notices: "Notices",
    language: "Change language",
    lightMode: "Light mode",
    darkMode: "Dark mode",
    mobileMenu: "Mobile menu",
    logout: "Log out",
    photoRequest: "Photo request",
    photoRequestHint: "Can't find the right image?",
  },
} as const;

export function TopNavBar() {
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(false);
  const { lang, t, toggle } = useLang();
  const copy = TOP_NAV_COPY[lang];
  const cartCount = useCart((s) => s.items.length);
  const { user, loading, init, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { init(); }, [init]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsDark(localStorage.getItem("theme") === "dark");
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

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
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

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
    { href: "/about",   label: t.nav.company },
    { href: "/library", label: t.nav.library },
    { href: "/notices", label: copy.notices },
    { href: "/contact?mode=photo", label: copy.photoRequest, highlight: true },
  ];

  return (
    <nav
      className={cn(
        "fixed top-0 w-full z-50 h-16 md:h-20 transition-all duration-300",
        isDark ? "glass-dark" : "glass"
      )}
    >
      <div className="flex justify-between items-center px-4 md:px-8 h-16 md:h-20 max-w-[1920px] mx-auto">

        {/* Brand */}
        <Link
          href="/"
          onClick={() => setMobileMenuOpen(false)}
          className="min-w-0 text-base md:text-lg font-headline font-black uppercase text-on-surface hover:text-primary transition-colors duration-200"
        >
          IMAGE PARTNERS
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-10">
          {NAV_LINKS.map(({ href, label, highlight }) => {
            const baseHref = href.split("?")[0];
            const isActive = pathname === baseHref || (baseHref !== "/" && pathname.startsWith(baseHref));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "group relative pb-1 text-sm font-medium leading-5 transition-colors duration-200",
                  highlight
                    ? "font-extrabold text-primary hover:text-primary-highlight"
                    : isActive
                    ? "text-primary border-b-2 border-primary"
                    : "text-on-surface-variant hover:text-on-surface"
                )}
              >
                {highlight && (
                  <span className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-full bg-on-surface px-2.5 py-1 text-[10px] font-extrabold leading-none text-surface shadow-lg ring-1 ring-outline-variant/20 transition-transform duration-200 group-hover:-translate-y-0.5 lg:inline-flex">
                    {copy.photoRequestHint}
                    <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-on-surface" />
                  </span>
                )}
                <span>{label}</span>
              </Link>
            );
          })}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1 h-9">

          {/* Language toggle */}
          <button
            onClick={toggle}
            className="inline-flex items-center justify-center gap-1 h-9 w-9 rounded-lg text-xs font-semibold text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all duration-200 sm:w-auto sm:px-3"
            aria-label={copy.language}
          >
            <span className="material-symbols-outlined text-base leading-none">language</span>
            <span className="hidden sm:inline">{lang === "ko" ? "KO" : "EN"}</span>
          </button>

          {/* Dark mode toggle */}
          <button
            onClick={toggleDark}
            className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all duration-200"
            aria-label={isDark ? copy.lightMode : copy.darkMode}
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

          <div className="hidden md:block w-px h-5 bg-outline-variant/40 mx-1" />

          {/* Auth section */}
          {loading ? (
            // Skeleton while loading — prevents login flash
            <div className="hidden md:block w-24 h-8 rounded-lg bg-surface-container-low animate-pulse" />
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
                    {copy.logout}
                  </button>
                </div>
              )}
            </div>
          ) : (
            // Logged out: login + signup buttons
            <div className="hidden md:flex items-center gap-1">
              <Link href="/login">
                <Button variant="ghost" size="sm">{t.nav.login}</Button>
              </Link>
              <Link href="/signup">
                <Button variant="primary" size="sm">{t.nav.signup}</Button>
              </Link>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((value) => !value)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface md:hidden"
            aria-label={copy.mobileMenu}
            aria-expanded={mobileMenuOpen}
          >
            <span className="material-symbols-outlined text-xl">{mobileMenuOpen ? "close" : "menu"}</span>
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-outline-variant/20 bg-surface/98 px-4 py-3 shadow-ghost backdrop-blur-md md:hidden">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map(({ href, label, highlight }) => {
              const baseHref = href.split("?")[0];
              const isActive = pathname === baseHref || (baseHref !== "/" && pathname.startsWith(baseHref));
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex h-11 items-center justify-between rounded-lg px-3 text-sm font-semibold transition-colors",
                    highlight ? "group text-primary hover:text-primary-highlight" : isActive ? "bg-primary/10 text-primary" : "text-on-surface hover:bg-surface-container-low"
                  )}
                >
                  <span>{label}</span>
                  <span className="ml-auto inline-flex min-w-0 items-center gap-2 pl-3">
                    {highlight && <span className="truncate text-[10px] font-medium text-primary/70 transition-colors group-hover:text-primary-highlight">{copy.photoRequestHint}</span>}
                    <span className="material-symbols-outlined shrink-0 text-base text-outline">chevron_right</span>
                  </span>
                </Link>
              );
            })}

            <div className="my-2 h-px bg-outline-variant/20" />

            {loading ? (
              <div className="h-10 rounded-lg bg-surface-container-low animate-pulse" />
            ) : user ? (
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-on-surface hover:bg-surface-container-low"
                >
                  <span className="material-symbols-outlined text-base text-outline">dashboard</span>
                  My Dashboard
                </Link>
                {user.is_admin && (
                  <Link
                    href="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-surface-container-low"
                  >
                    <span className="material-symbols-outlined text-base">admin_panel_settings</span>
                    Admin
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => { setMobileMenuOpen(false); signOut(); }}
                  className="flex h-11 items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold text-on-surface hover:bg-surface-container-low"
                >
                  <span className="material-symbols-outlined text-base text-outline">logout</span>
                  {copy.logout}
                </button>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex h-11 items-center justify-center rounded-lg border border-outline-variant text-sm font-bold text-on-surface"
                >
                  {t.nav.login}
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex h-11 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white"
                >
                  {t.nav.signup}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
