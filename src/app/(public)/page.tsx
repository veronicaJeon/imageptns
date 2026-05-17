"use client";

import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import { useLang } from "@/lib/i18n/store";

const IMAGES = {
  hero:      "https://picsum.photos/seed/lobby/1920/870",
  editorial: "https://picsum.photos/seed/editorial/800/500",
  timeline:  [
    "https://picsum.photos/seed/darkroom/800/450",
    "https://picsum.photos/seed/servers/800/450",
    "https://picsum.photos/seed/aidata/800/450",
  ],
};

const VALUE_ICONS = ["verified_user", "brush", "diversity_3"];

const PARTNERS = ["THE GUARDIAN", "VOGUE", "TIME", "NATIONAL GEOGRAPHIC", "WIRED"];

export default function HomePage() {
  const { t } = useLang();
  const h = t.home;

  return (
    <>
      {/* ── 1. Hero ─────────────────────────────── */}
      <section className="relative h-[870px] w-full overflow-hidden flex items-center px-8 md:px-24">
        <div className="absolute inset-0 z-0">
          <Image
            src={IMAGES.hero}
            alt="Corporate headquarters lobby"
            fill
            className="object-cover grayscale brightness-50"
            priority
            unoptimized
          />
        </div>

        <div className="relative z-10 max-w-5xl">
          <Badge variant="accent" className="mb-6">{h.hero.badge}</Badge>
          <h1 className="font-headline text-5xl md:text-8xl font-extrabold text-white leading-tight tracking-tighter mb-8">
            {h.hero.headline1} <br />
            <span className="text-primary-container">{h.hero.headline2}</span>
          </h1>
          <p className="text-zinc-300 text-lg md:text-xl max-w-2xl font-light leading-relaxed">
            {h.hero.description}
          </p>
        </div>

        <div className="absolute bottom-12 right-12 hidden md:flex flex-col items-end gap-2 text-white/50 text-xs tracking-[0.2em] uppercase">
          <span>{h.hero.scroll}</span>
          <div className="w-20 h-px bg-white/20 relative overflow-hidden">
            <div className="absolute inset-0 bg-primary-container w-1/3 animate-pulse" />
          </div>
        </div>
      </section>

      {/* ── 2. About / Mission ──────────────────── */}
      <section className="py-32 px-8 md:px-24 bg-surface">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-16 max-w-7xl mx-auto">

          <div className="md:col-span-5 flex flex-col justify-center">
            <h2 className="font-headline text-4xl md:text-5xl font-extrabold text-on-surface mb-8 tracking-tighter leading-none">
              {h.about.headline1} <br />{h.about.headline2}
            </h2>
            <div className="w-16 h-1 bg-primary mb-12" />
            <p className="text-on-surface-variant leading-loose text-lg mb-8">
              {h.about.body}
            </p>
          </div>

          <div className="md:col-span-7">
            <div className="relative group">
              <div className="aspect-[16/10] overflow-hidden shadow-ghost">
                <Image
                  src={IMAGES.editorial}
                  alt="Editorial team working"
                  width={800}
                  height={500}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  unoptimized
                />
              </div>
              <div className="absolute -bottom-8 -left-8 md:bottom-12 md:-left-12 bg-surface-container-lowest p-8 shadow-ghost max-w-sm hidden sm:block">
                <h3 className="font-headline font-bold text-xl mb-4 text-on-surface">
                  {h.about.floatTitle}
                </h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  {h.about.floatBody}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Values ───────────────────────────── */}
      <section className="py-24 px-8 md:px-24 bg-surface-container-low">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {h.values.items.map(({ title, desc }, i) => (
            <div
              key={title}
              className="bg-surface-container-lowest p-12 shadow-ghost flex flex-col items-start gap-6"
            >
              <span className="material-symbols-outlined text-4xl text-primary">
                {VALUE_ICONS[i]}
              </span>
              <h4 className="font-headline text-2xl font-bold tracking-tight text-on-surface">
                {title}
              </h4>
              <p className="text-on-surface-variant leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. Timeline ─────────────────────────── */}
      <section className="py-32 px-8 md:px-24 bg-surface">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="font-headline text-4xl font-extrabold mb-4 uppercase tracking-widest text-on-surface">
              {h.timeline.title}
            </h2>
            <p className="text-on-surface-variant">{h.timeline.subtitle}</p>
          </div>

          <div className="space-y-24">
            {h.timeline.items.map(({ year, title, desc }, i) => {
              const reverse = i % 2 === 1;
              return (
                <div
                  key={year}
                  className={`flex flex-col ${reverse ? "md:flex-row-reverse" : "md:flex-row"} items-center gap-12 group`}
                >
                  <div className={`md:w-1/2 ${reverse ? "md:text-left" : "md:text-right"}`}>
                    <span className="font-headline text-6xl font-black text-primary/10 group-hover:text-primary/20 transition-colors">
                      {year}
                    </span>
                    <h5 className="text-2xl font-bold mt-2 text-on-surface">{title}</h5>
                    <p className="text-on-surface-variant mt-4 leading-relaxed">{desc}</p>
                  </div>

                  <div className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center shrink-0">
                    <div className="w-4 h-4 bg-primary rounded-full" />
                  </div>

                  <div className="md:w-1/2 aspect-video overflow-hidden shadow-ghost">
                    <Image
                      src={IMAGES.timeline[i]}
                      alt={title}
                      width={800}
                      height={450}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 5. Partners ─────────────────────────── */}
      <section className="py-24 bg-surface-container-high px-8">
        <div className="max-w-7xl mx-auto">
          <h3 className="text-center font-headline text-sm font-bold uppercase tracking-[0.3em] text-outline mb-16">
            {h.partners.label}
          </h3>
          <div className="flex flex-wrap justify-center items-center gap-16 md:gap-24 opacity-60">
            {PARTNERS.map((name) => (
              <span key={name} className="font-headline text-2xl font-extrabold text-on-surface tracking-tighter">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. CTA ──────────────────────────────── */}
      <section className="py-32 px-8 bg-primary">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-headline text-4xl md:text-6xl font-extrabold text-white mb-8 tracking-tight">
            {h.cta.headline1} <br />
            {h.cta.headline2}
          </h2>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/library"
              className="px-10 py-5 bg-white text-primary font-bold rounded shadow-ghost hover:bg-zinc-100 transition-colors uppercase tracking-widest text-sm"
            >
              {h.cta.browse}
            </Link>
            <Link
              href="/contact"
              className="px-10 py-5 border border-white/30 text-white font-bold rounded hover:bg-white/10 transition-colors uppercase tracking-widest text-sm"
            >
              {h.cta.contact}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
