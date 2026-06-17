"use client";

import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { NoticePopup } from "@/components/ui/NoticePopup";
import { useLang } from "@/lib/i18n/store";

const IMAGES = {
  hero: "https://picsum.photos/seed/lobby/1920/870",
  editorial: "https://picsum.photos/seed/editorial/800/500",
};

const VALUE_ICONS = ["verified_user", "subtitles", "diversity_3"];

export default function AboutPage() {
  const { t } = useLang();
  const h = t.home;

  return (
    <>
      <NoticePopup />

      <section className="relative flex min-h-[720px] w-full items-center overflow-hidden px-8 md:px-24">
        <div className="absolute inset-0 z-0">
          <Image
            src={IMAGES.hero}
            alt="Image Partners"
            fill
            className="object-cover grayscale brightness-50"
            priority
            unoptimized
          />
        </div>

        <div className="relative z-10 max-w-5xl">
          {h.hero.badge && (
            <Badge variant="accent" className="mb-6">
              {h.hero.badge}
            </Badge>
          )}
          <h1 className="mb-8 font-headline text-5xl font-extrabold leading-tight tracking-tighter text-white md:text-8xl">
            {h.hero.headline1}
            <br />
            <span className="text-primary-container">{h.hero.headline2}</span>
          </h1>
          <p className="max-w-2xl text-lg font-light leading-relaxed text-zinc-300 md:text-xl">
            {h.hero.description}
          </p>
        </div>
      </section>

      <section className="bg-surface px-8 py-32 md:px-24">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-16 md:grid-cols-12">
          <div className="flex flex-col justify-center md:col-span-5">
            <h2 className="mb-8 font-headline text-4xl font-extrabold leading-none tracking-tighter text-on-surface md:text-5xl">
              {h.about.headline1}
              <br />
              {h.about.headline2}
            </h2>
            <div className="mb-12 h-1 w-16 bg-primary" />
            <p className="text-lg leading-loose text-on-surface-variant">{h.about.body}</p>
          </div>

          <div className="md:col-span-7">
            <div className="aspect-[16/10] overflow-hidden shadow-ghost">
              <Image
                src={IMAGES.editorial}
                alt="Editorial image curation"
                width={800}
                height={500}
                className="h-full w-full object-cover"
                unoptimized
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface-container-low px-8 py-24 md:px-24">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 md:grid-cols-3">
          {h.values.items.map(({ title, desc }, i) => (
            <div
              key={title}
              className="flex flex-col items-start gap-6 bg-surface-container-lowest p-12 shadow-ghost"
            >
              <span className="material-symbols-outlined text-4xl text-primary">
                {VALUE_ICONS[i] ?? "verified"}
              </span>
              <h3 className="font-headline text-2xl font-bold tracking-tight text-on-surface">
                {title}
              </h3>
              <p className="leading-relaxed text-on-surface-variant">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/*
        Timeline, founding-date, restoration mastery, and partner-logo sections are hidden
        until the company history and trust-copy claims are verified for public launch.
      */}

      <section className="bg-primary px-8 py-32">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-8 font-headline text-4xl font-extrabold tracking-tight text-white md:text-6xl">
            {h.cta.headline1}
            <br />
            {h.cta.headline2}
          </h2>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/library"
              className="rounded bg-white px-10 py-5 text-sm font-bold uppercase tracking-widest text-primary shadow-ghost transition-colors hover:bg-zinc-100"
            >
              {h.cta.browse}
            </Link>
            <Link
              href="/contact"
              className="rounded border border-white/30 px-10 py-5 text-sm font-bold uppercase tracking-widest text-white transition-colors hover:bg-white/10"
            >
              {h.cta.contact}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
