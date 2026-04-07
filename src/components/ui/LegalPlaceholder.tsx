"use client";

import Link from "next/link";
import { useLang } from "@/lib/i18n/store";

interface LegalPlaceholderProps {
  titleKey: string;
}

export function LegalPlaceholder({ titleKey }: LegalPlaceholderProps) {
  const { t } = useLang();
  const l = t.legal;

  return (
    <section className="pt-36 pb-32 px-6 bg-surface min-h-screen flex flex-col items-center justify-center text-center">
      <span className="material-symbols-outlined text-6xl text-outline mb-6">description</span>
      <h1 className="font-headline text-3xl font-extrabold text-on-surface mb-3">{titleKey}</h1>
      <p className="text-on-surface-variant mb-2">{l.comingSoon}</p>
      <p className="text-sm text-outline max-w-sm mb-10">{l.comingSoonSub}</p>
      <Link href="/" className="text-xs font-bold uppercase tracking-widest text-primary hover:underline flex items-center gap-1">
        <span className="material-symbols-outlined text-base">arrow_back</span>
        {l.backBtn}
      </Link>
    </section>
  );
}
