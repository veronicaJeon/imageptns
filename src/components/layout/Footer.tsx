import Link from "next/link";

const FOOTER_LINKS = {
  Resources: [
    { href: "/library",  label: "Image Library" },
    { href: "/support",  label: "Q&A" },
    { href: "#",         label: "Pricing" },
    { href: "#",         label: "Blog" },
  ],
  Legal: [
    { href: "#", label: "Terms of Service" },
    { href: "#", label: "Privacy Policy" },
    { href: "#", label: "License Guide" },
    { href: "#", label: "Cookie Policy" },
  ],
  Company: [
    { href: "/",    label: "About Us" },
    { href: "#",    label: "Careers" },
    { href: "#",    label: "Press" },
    { href: "#",    label: "Contact" },
  ],
};

export function Footer() {
  return (
    <footer className="bg-surface-container-low dark:bg-zinc-950 w-full py-16 px-6 md:px-8 font-body text-sm">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-12 max-w-7xl mx-auto">

        {/* ── 브랜드 컬럼 ── */}
        <div className="col-span-1">
          <div className="text-base font-headline font-black uppercase tracking-tighter text-on-surface mb-4">
            IMAGE PARTNERS
          </div>
          <p className="text-on-surface-variant leading-relaxed mb-6">
            The Digital Curator. 1994년 런던에서 시작된 프리미엄 스톡 이미지 플랫폼.
          </p>
          <p className="text-outline text-xs">© 2026 Image Partners. All rights reserved.</p>
        </div>

        {/* ── 링크 컬럼들 ── */}
        {Object.entries(FOOTER_LINKS).map(([category, links]) => (
          <div key={category} className="flex flex-col gap-4">
            <h6 className="font-bold text-on-surface uppercase tracking-widest text-xs">
              {category}
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
