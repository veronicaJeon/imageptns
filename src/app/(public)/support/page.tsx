"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useLang } from "@/lib/i18n/store";

type Category = "all" | "account" | "licensing" | "billing" | "technical";

const FAQ_CATEGORIES: Category[] = ["all", "account", "licensing", "billing", "technical"];

// Map each FAQ index to a category (matches order in translations)
const FAQ_CATEGORY_MAP: Category[] = [
  "account",    // 0 download
  "licensing",  // 1 license types
  "licensing",  // 2 social media
  "account",    // 3 submit photography
  "technical",  // 4 file formats
  "billing",    // 5 payments
  "billing",    // 6 cancel subscription
  "account",    // 7 free trial
];

export default function SupportPage() {
  const { t } = useLang();
  const s = t.support;

  const [query, setQuery]         = useState("");
  const [category, setCategory]   = useState<Category>("all");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const filtered = useMemo(() => {
    return s.faqs
      .map((faq, i) => ({ ...faq, i, cat: FAQ_CATEGORY_MAP[i] }))
      .filter(({ question, answer, cat }) => {
        const matchCat = category === "all" || cat === category;
        const q = query.toLowerCase();
        const matchQ = !q || question.toLowerCase().includes(q) || answer.toLowerCase().includes(q);
        return matchCat && matchQ;
      });
  }, [query, category, s.faqs]);

  return (
    <>
      {/* ── Hero ─────────────────────────────────── */}
      <section className="pt-36 pb-20 px-6 bg-surface text-center">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-headline text-4xl md:text-6xl font-extrabold tracking-tighter text-on-surface mb-4">
            {s.hero.headline}
          </h1>
          <p className="text-on-surface-variant mb-8">{s.hero.sub}</p>

          <div className="relative flex items-center bg-surface-container-lowest shadow-ghost rounded-lg overflow-hidden">
            <span className="material-symbols-outlined text-outline pl-5 pr-3 text-2xl shrink-0">search</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={s.hero.searchPlaceholder}
              className="flex-1 py-4 pr-4 bg-transparent text-on-surface placeholder:text-outline text-sm outline-none"
            />
            {query && (
              <button onClick={() => setQuery("")} className="px-4 text-outline hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────── */}
      <section className="py-16 px-6 md:px-8 bg-surface-container-low min-h-[50vh]">
        <div className="max-w-3xl mx-auto">

          {/* Category pills */}
          <div className="flex flex-wrap gap-2 mb-10">
            {FAQ_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => { setCategory(cat); setOpenIndex(null); }}
                className={[
                  "px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-colors duration-200",
                  category === cat
                    ? "bg-primary-container text-on-primary-container"
                    : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high",
                ].join(" ")}
              >
                {s.categories[cat]}
              </button>
            ))}
          </div>

          {/* FAQ list */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-20 gap-4 text-outline">
              <span className="material-symbols-outlined text-5xl">help_outline</span>
              <p>{s.noResults}</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-outline-variant/20">
              {filtered.map(({ question, answer, i }) => {
                const isOpen = openIndex === i;
                return (
                  <div key={i} className="py-1">
                    <button
                      onClick={() => setOpenIndex(isOpen ? null : i)}
                      className="w-full flex items-center justify-between py-5 text-left gap-4 group"
                    >
                      <span className="font-medium text-on-surface group-hover:text-primary transition-colors text-base">
                        {question}
                      </span>
                      <span
                        className={[
                          "material-symbols-outlined text-outline shrink-0 transition-transform duration-300",
                          isOpen ? "rotate-180" : "",
                        ].join(" ")}
                      >
                        expand_more
                      </span>
                    </button>

                    <div
                      className={[
                        "overflow-hidden transition-all duration-300",
                        isOpen ? "max-h-96 pb-6" : "max-h-0",
                      ].join(" ")}
                    >
                      <p className="text-on-surface-variant leading-relaxed text-sm">{answer}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Contact CTA ──────────────────────────── */}
      <section className="py-24 px-6 bg-surface text-center">
        <div className="max-w-lg mx-auto">
          <span className="material-symbols-outlined text-5xl text-primary mb-6 block">support_agent</span>
          <h2 className="font-headline text-2xl font-extrabold text-on-surface mb-3">{s.contact.title}</h2>
          <p className="text-on-surface-variant mb-8 text-sm">{s.contact.sub}</p>
          <Link href="/contact" className="inline-block px-8 py-4 bg-primary text-white font-bold text-xs uppercase tracking-widest rounded hover:opacity-90 transition-opacity">
            {s.contact.btn}
          </Link>
        </div>
      </section>
    </>
  );
}
