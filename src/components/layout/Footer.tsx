"use client";

import Link from "next/link";
import { useLang } from "@/lib/i18n/store";

export function Footer() {
  const { t } = useLang();
  const f = t.footer;

  const FOOTER_DATA = [
    {
      key: "Resources",
      links: [
        { href: "/library",  label: f.links.imageLibrary },
        { href: "/support",  label: f.links.qa },
        { href: "/pricing",  label: f.links.pricing },
        { href: "#",         label: f.links.blog },
      ],
    },
    {
      key: "Legal",
      links: [
        { href: "/terms",         label: f.links.terms },
        { href: "/privacy",       label: f.links.privacy },
        { href: "/license-guide", label: f.links.licenseGuide },
        { href: "/cookie",        label: f.links.cookie },
      ],
    },
    {
      key: "Company",
      links: [
        { href: "/",        label: f.links.about },
        { href: "#",        label: f.links.careers },
        { href: "#",        label: f.links.press },
        { href: "/contact", label: f.links.contact },
      ],
    },
  ];

  return (
    <footer className="bg-surface-container-low w-full py-16 px-6 md:px-8 font-body text-sm">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-12 max-w-7xl mx-auto">

        {/* 브랜드 컬럼 */}
        <div className="col-span-1">
          <div className="text-base font-headline font-black uppercase tracking-tighter text-on-surface mb-4">
            IMAGE PARTNERS
          </div>
          <p className="text-on-surface-variant leading-relaxed mb-6">{f.tagline}</p>
          <p className="text-outline text-xs">{f.copyright}</p>
        </div>

        {/* 링크 컬럼들 */}
        {FOOTER_DATA.map(({ key, links }) => (
          <div key={key} className="flex flex-col gap-4">
            <h6 className="font-bold text-on-surface uppercase tracking-widest text-xs">
              {f.sections[key as keyof typeof f.sections]}
            </h6>
            {links.map(({ href, label }) => (
              <Link
                key={label}
                href={href}
                className="text-on-surface-variant hover:text-primary transition-colors duration-200"
              >
                {label}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </footer>
  );
}
