"use client";

import { useState } from "react";
import Link from "next/link";
import { useLang } from "@/lib/i18n/store";

export default function PricingPage() {
  const { t } = useLang();
  const p = t.pricing;
  const [annual, setAnnual] = useState(false);

  return (
    <>
      {/* ── Hero ── */}
      <section className="pt-36 pb-16 px-6 bg-surface text-center">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-headline text-4xl md:text-5xl font-extrabold tracking-tighter text-on-surface mb-4">
            {p.hero.headline}
          </h1>
          <p className="text-on-surface-variant mb-8">{p.hero.sub}</p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-3 bg-surface-container-low rounded-full p-1">
            <button
              onClick={() => setAnnual(false)}
              className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${!annual ? "bg-surface-container-lowest shadow text-on-surface" : "text-on-surface-variant"}`}
            >
              {p.toggle.monthly}
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-5 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${annual ? "bg-surface-container-lowest shadow text-on-surface" : "text-on-surface-variant"}`}
            >
              {p.toggle.annual}
              <span className="text-[10px] font-black text-primary-container bg-primary px-2 py-0.5 rounded-full">{p.toggle.discount}</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Plans ── */}
      <section className="pb-24 px-6 md:px-8 bg-surface">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {p.plans.map((plan, i) => {
            const featured = i === 1;
            return (
              <div
                key={plan.name}
                className={[
                  "flex flex-col p-8 shadow-ghost",
                  featured
                    ? "bg-primary text-white scale-[1.02] md:-mt-4"
                    : "bg-surface-container-lowest text-on-surface",
                ].join(" ")}
              >
                <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${featured ? "text-primary-container" : "text-outline"}`}>
                  {plan.name}
                </p>
                <div className="mb-2">
                  <span className="font-headline text-4xl font-extrabold">
                    {annual ? plan.priceAnn : plan.price}
                  </span>
                  {plan.price !== "Custom" && plan.price !== "맞춤 견적" && (
                    <span className={`text-sm ml-1 ${featured ? "text-white/60" : "text-outline"}`}>/mo</span>
                  )}
                </div>
                <p className={`text-sm mb-8 ${featured ? "text-white/70" : "text-on-surface-variant"}`}>{plan.desc}</p>

                <ul className="flex flex-col gap-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <span className={`material-symbols-outlined text-base mt-0.5 shrink-0 ${featured ? "text-primary-container" : "text-primary"}`}>
                        check_circle
                      </span>
                      <span className={featured ? "text-white/90" : "text-on-surface-variant"}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/signup"
                  className={[
                    "block text-center py-3 text-xs font-bold uppercase tracking-widest rounded transition-all",
                    featured
                      ? "bg-white text-primary hover:bg-zinc-100"
                      : "bg-primary text-white hover:opacity-90",
                  ].join(" ")}
                >
                  {plan.cta}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Enterprise CTA ── */}
      <section className="py-20 px-6 bg-surface-container-low text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="font-headline text-2xl font-extrabold text-on-surface mb-3">{p.enterprise.title}</h2>
          <p className="text-on-surface-variant mb-8">{p.enterprise.sub}</p>
          <Link
            href="/contact"
            className="inline-block px-8 py-4 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity"
          >
            {p.enterprise.btn}
          </Link>
        </div>
      </section>
    </>
  );
}
