"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Notice {
  id: string;
  title: string;
  body: string;
  is_popup: boolean;
  published_at: string | null;
  created_at: string;
}

export default function NoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/notices")
      .then((r) => r.json())
      .then(({ notices: n }) => setNotices(n ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="pt-28 pb-6 px-6 md:px-12 bg-surface">
        <nav className="flex items-center gap-2 text-xs text-outline mb-6">
          <Link href="/" className="hover:text-primary transition-colors">Home</Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span className="text-on-surface-variant">공지사항</span>
        </nav>
        <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">공지사항</h1>
      </div>

      <section className="px-6 md:px-12 pb-24 bg-surface">
        <div className="max-w-3xl mx-auto">
          {loading && (
            <div className="flex justify-center py-24">
              <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && notices.length === 0 && (
            <div className="flex flex-col items-center py-24 gap-3 text-outline">
              <span className="material-symbols-outlined text-5xl">campaign</span>
              <p className="text-sm">등록된 공지사항이 없습니다.</p>
            </div>
          )}

          {!loading && notices.length > 0 && (
            <div className="divide-y divide-outline-variant/20">
              {notices.map((n, idx) => (
                <div key={n.id} className="py-6">
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === n.id ? null : n.id)}
                    className="w-full flex items-start justify-between gap-4 text-left group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-bold text-outline uppercase tracking-widest">
                          #{String(notices.length - idx).padStart(3, "0")}
                        </span>
                        {n.is_popup && (
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-widest">
                            중요
                          </span>
                        )}
                        <span className="text-[10px] text-outline">
                          {new Date(n.published_at ?? n.created_at).toLocaleDateString("ko-KR", {
                            year: "numeric", month: "2-digit", day: "2-digit",
                          })}
                        </span>
                      </div>
                      <h2 className="text-base font-bold text-on-surface group-hover:text-primary transition-colors">
                        {n.title}
                      </h2>
                    </div>
                    <span
                      className="material-symbols-outlined text-xl text-outline transition-transform duration-200 shrink-0 mt-1"
                      style={{ transform: expanded === n.id ? "rotate(180deg)" : "none" }}
                    >
                      expand_more
                    </span>
                  </button>

                  {expanded === n.id && (
                    <div className="mt-4 pt-4 border-t border-outline-variant/20 text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">
                      {n.body}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
