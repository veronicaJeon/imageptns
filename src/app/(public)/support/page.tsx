"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useLang } from "@/lib/i18n/store";
import { AccordionItem, CategoryPill, SearchInput } from "@/components/ui";

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

          <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder={s.hero.searchPlaceholder} aria-label={s.hero.searchPlaceholder} />
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────── */}
      <section className="py-16 px-6 md:px-8 bg-surface-container-low min-h-[50vh]">
        <div className="max-w-3xl mx-auto">

          {/* Category pills */}
          <div className="flex flex-wrap gap-2 mb-10">
            {FAQ_CATEGORIES.map((cat) => (
              <CategoryPill
                key={cat}
                onClick={() => setCategory(cat)}
                active={category === cat}
                label={s.categories[cat]}
                className="text-xs uppercase tracking-widest"
              />
            ))}
          </div>

          {/* FAQ list */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-20 gap-4 text-outline">
              <span className="material-symbols-outlined text-5xl">help_outline</span>
              <p>{s.noResults}</p>
            </div>
          ) : (
            <div className="ui-surface overflow-hidden">
              {filtered.map(({ question, answer, i }) => (
                <AccordionItem key={i} question={question} answer={answer} />
              ))}
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
          <Link href="/contact" className="ui-interactive inline-flex min-h-14 items-center justify-center rounded-lg bg-primary px-8 py-4 text-xs font-bold uppercase tracking-widest text-white shadow-sm hover:-translate-y-px hover:bg-primary-highlight hover:shadow-md">
            {s.contact.btn}
          </Link>
        </div>
      </section>
    </>
  );
}
