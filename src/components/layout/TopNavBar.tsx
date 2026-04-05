"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";

const NAV_LINKS = [
  { href: "/library", label: "Library" },
  { href: "/",        label: "Company" },
  { href: "/support", label: "Q&A" },
];

export function TopNavBar() {
  const pathname = usePathname();
  const [lang, setLang] = useState<"ko" | "en">("ko");

  return (
    <nav className="fixed top-0 w-full z-50 glass h-20 dark:glass-dark">
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

        {/* ── 우측 액션 ── */}
        <div className="flex items-center gap-4">
          {/* 언어 토글 */}
          <button
            onClick={() => setLang((l) => (l === "ko" ? "en" : "ko"))}
            className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all duration-200"
            aria-label="언어 변경"
          >
            <span className="material-symbols-outlined text-xl">language</span>
          </button>

          {/* 다크모드 토글 */}
          <button
            className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all duration-200"
            aria-label="테마 변경"
          >
            <span className="material-symbols-outlined text-xl">dark_mode</span>
          </button>

          {/* 로그인 */}
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Login
            </Button>
          </Link>

          {/* 가입 */}
          <Link href="/signup">
            <Button variant="primary" size="sm">
              Sign Up
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
