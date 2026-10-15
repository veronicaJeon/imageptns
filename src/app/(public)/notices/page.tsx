"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLang } from "@/lib/i18n/store";
import { AccordionItem } from "@/components/ui/Accordion";

interface Notice {
  id: string;
  title: string;
  body: string;
  is_popup: boolean;
  published_at: string | null;
  created_at: string;
}

const NOTICES_COPY = {
  ko: { title: "공지사항", empty: "등록된 공지사항이 없습니다.", important: "중요", locale: "ko-KR" },
  en: { title: "Notices", empty: "No notices have been published yet.", important: "Important", locale: "en-US" },
} as const;

export default function NoticesPage() {
  const { lang } = useLang();
  const copy = NOTICES_COPY[lang];
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notices")
      .then((r) => r.json())
      .then(({ notices: n }) => setNotices(n ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <header className="bg-surface px-5 pb-10 pt-28 md:px-8 md:pb-14 md:pt-36">
        <div className="reading-shell">
        <nav className="mb-7 flex items-center gap-2 text-xs text-outline">
          <Link href="/" className="hover:text-primary transition-colors">Home</Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span className="text-on-surface-variant">{copy.title}</span>
        </nav>
        <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-primary">Image Partners</p>
        <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">{copy.title}</h1>
        {!loading && <p className="mt-4 text-sm text-on-surface-variant">{lang === "ko" ? `총 ${notices.length}개의 소식` : `${notices.length} updates`}</p>}
        </div>
      </header>

      <section className="bg-surface px-5 pb-28 md:px-8">
        <div className="reading-shell">
          {loading && (
            <div className="flex justify-center py-24">
              <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && notices.length === 0 && (
            <div className="flex flex-col items-center py-24 gap-3 text-outline">
              <span className="material-symbols-outlined text-5xl">campaign</span>
              <p className="text-sm">{copy.empty}</p>
            </div>
          )}

          {!loading && notices.length > 0 && (
            <div className="ui-surface overflow-hidden">
              {notices.map((n, idx) => (
                <AccordionItem
                  key={n.id}
                  className="px-5 sm:px-6"
                  eyebrow={
                    <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold text-outline uppercase tracking-widest">
                          #{String(notices.length - idx).padStart(3, "0")}
                        </span>
                        {n.is_popup && (
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-widest">
                            {copy.important}
                          </span>
                        )}
                        <span className="text-[10px] text-outline">
                          {new Date(n.published_at ?? n.created_at).toLocaleDateString(copy.locale, {
                            year: "numeric", month: "2-digit", day: "2-digit",
                          })}
                        </span>
                    </span>
                  }
                  question={n.title}
                  answer={<p className="whitespace-pre-wrap">{n.body}</p>}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
