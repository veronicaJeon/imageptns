"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";

const NAV_LINKS = [
  { href: "/library", label: "Library" },
  { href: "/",        label: "Company" },
  { href: "/support", label: "Q&A" },
];

export function TopNavBar() {
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(false);
  const [lang, setLang] = useState<"KO" | "EN">("KO");

  // ── 초기화: localStorage에서 테마 복원 ──
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    }
  }, []);

  // ── 다크모드 토글 ──
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

  // ── 언어 토글 ──
  function toggleLang() {
    setLang((l) => (l === "KO" ? "EN" : "KO"));
    // TODO: next-intl 연동 시 실제 라우팅으로 교체
  }

  return (
    <nav
      className={cn(
        "fixed top-0 w-full z-50 h-20 transition-all duration-300",
        isDark ? "glass-dark" : "glass"
      )}
    >
      <div className="flex justify-between items-center px-6 md:px-8 h-20 max-w-[1920px] mx-auto">

        {/* ── 브랜드 로고 ── */}
        <Link
          href="/"
          className="text-lg font-headline font-black uppercase tracking-tighter text-on-surface hover:text-primary transition-colors duration-200"
        >
          IMAGE PARTNERS
        </Link>

        {/* ── 네비 링크 (데스크탑) ── */}
        <div className="hidden md:flex items-center gap-10">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive =
              pathname === href || (href !== "/" && pathname.startsWith(href));
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

        {/* ── 우측 액션 ── */}
        <div className="flex items-center gap-2">

          {/* 언어 토글 */}
          <button
            onClick={toggleLang}
            className={cn(
              "flex items-center gap-1 px-3 py-2 rounded-full text-xs font-bold tracking-widest",
              "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
              "transition-all duration-200"
            )}
            aria-label="언어 변경"
          >
            <span className="material-symbols-outlined text-base">language</span>
            <span>{lang}</span>
          </button>

          {/* 다크모드 토글 */}
          <button
            onClick={toggleDark}
            className={cn(
              "p-2 rounded-full transition-all duration-200",
              "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            )}
            aria-label={isDark ? "라이트 모드로 변경" : "다크 모드로 변경"}
          >
            <span className="material-symbols-outlined text-xl">
              {isDark ? "light_mode" : "dark_mode"}
            </span>
          </button>

          {/* 구분선 */}
          <div className="w-px h-5 bg-outline-variant/40 mx-1" />

          {/* 로그인 */}
          <Link href="/login">
            <Button variant="ghost" size="sm">Login</Button>
          </Link>

          {/* 가입 */}
          <Link href="/signup">
            <Button variant="primary" size="sm">Sign Up</Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
