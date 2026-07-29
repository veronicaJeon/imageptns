"use client";

import Link from "next/link";
import { useLang } from "@/lib/i18n/store";

export function Footer() {
  const { lang, t } = useLang();
  const f = t.footer;

  return (
    <footer className="bg-surface-container-low w-full px-6 py-12 font-body text-sm md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div className="max-w-xl">
          <div className="text-base font-headline font-black uppercase text-on-surface mb-4">
            IMAGE PARTNERS
          </div>
          <p className="text-on-surface-variant leading-relaxed mb-6">{f.tagline}</p>
          <p className="text-outline text-xs">{f.copyright}</p>
        </div>

        <address className="not-italic leading-relaxed text-on-surface-variant">
          <p className="mb-3 text-xs font-semibold text-on-surface">
            {f.company.title}
          </p>
          <p>{f.company.address}</p>
          <a href={`mailto:${f.company.email}`} className="transition-colors hover:text-primary">
            {f.company.email}
          </a>
        </address>
      </div>
      <nav className="mx-auto mt-8 flex max-w-7xl flex-wrap gap-x-5 gap-y-2 border-t border-outline-variant/30 pt-6 text-xs text-outline">
        <Link href="/terms" className="hover:text-primary">{f.links.terms}</Link>
        <Link href="/privacy" className="hover:text-primary">{f.links.privacy}</Link>
        <Link href="/license-guide" className="hover:text-primary">{f.links.licenseGuide}</Link>
        <Link href="/cookie" className="hover:text-primary">{f.links.cookie}</Link>
        <Link href="/business-info" className="hover:text-primary">
          {lang === "ko" ? "사업자정보·공시사항" : "Business information"}
        </Link>
      </nav>
    </footer>
  );
}
