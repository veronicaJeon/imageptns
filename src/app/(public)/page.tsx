import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/Badge";

// ── 타임라인 데이터 ──────────────────────────────
const TIMELINE = [
  {
    year: "1994",
    title: "Founding",
    desc: "IMAGE PARTNERS launched as a specialized boutique agency for documentary photography in London, focusing on historical archives.",
    img: "https://picsum.photos/seed/darkroom/800/450",
    alt: "Vintage darkroom",
    reverse: false,
  },
  {
    year: "2008",
    title: "Digital Expansion",
    desc: "Completion of our first 10-million-image digitization project, becoming the primary partner for major European newspapers.",
    img: "https://picsum.photos/seed/servers/800/450",
    alt: "Server room technology",
    reverse: true,
  },
  {
    year: "2024",
    title: "Next Gen Archives",
    desc: "Implementation of high-speed AI curation, allowing for instantaneous visual search across our global curated collections.",
    img: "https://picsum.photos/seed/aidata/800/450",
    alt: "Futuristic data connection",
    reverse: false,
  },
];

// ── 가치 카드 데이터 ─────────────────────────────
const VALUES = [
  {
    icon: "verified_user",
    title: "Authenticity First",
    desc: "Every image in our archive is rigorously verified for metadata accuracy and legal clearance, ensuring peace of mind for global publishers.",
  },
  {
    icon: "brush",
    title: "Restoration Mastery",
    desc: "Our in-house digital preservation lab breathes new life into historical negatives using proprietary AI-assisted enhancement tools.",
  },
  {
    icon: "diversity_3",
    title: "Global Network",
    desc: "With partners in 40+ countries, we provide a truly international perspective on culture, history, and news through local eyes.",
  },
];

// ── 파트너 로고 ──────────────────────────────────
const PARTNERS = [
  "THE GUARDIAN",
  "VOGUE",
  "TIME",
  "NATIONAL GEOGRAPHIC",
  "WIRED",
];

export default function HomePage() {
  return (
    <>
      {/* ─── 1. Hero ─────────────────────────────── */}
      <section className="relative h-[870px] w-full overflow-hidden flex items-center px-8 md:px-24">
        {/* 배경 이미지 */}
        <div className="absolute inset-0 z-0">
          <Image
            src="https://picsum.photos/seed/lobby/1920/870"
            alt="Corporate headquarters lobby"
            fill
            className="object-cover grayscale brightness-50"
            priority
            unoptimized
          />
        </div>

        {/* 콘텐츠 */}
        <div className="relative z-10 max-w-5xl">
          <Badge variant="accent" className="mb-6">Est. 1994</Badge>

          <h1 className="font-headline text-5xl md:text-8xl font-extrabold text-white leading-tight tracking-tighter mb-8">
            WE CURATE <br />
            <span className="text-primary-container">VISUAL EXCELLENCE.</span>
          </h1>

          <p className="text-zinc-300 text-lg md:text-xl max-w-2xl font-light leading-relaxed">
            A premier archival and contemporary image agency dedicated to the
            publishing industry, bridging the gap between historical significance
            and modern storytelling.
          </p>
        </div>

        {/* 스크롤 힌트 */}
        <div className="absolute bottom-12 right-12 hidden md:flex flex-col items-end gap-2 text-white/50 text-xs tracking-[0.2em] uppercase">
          <span>Scroll to explore</span>
          <div className="w-20 h-px bg-white/20 relative overflow-hidden">
            <div className="absolute inset-0 bg-primary-container w-1/3 animate-pulse" />
          </div>
        </div>
      </section>

      {/* ─── 2. About / Mission ──────────────────── */}
      <section className="py-32 px-8 md:px-24 bg-surface max-w-[1920px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-16 max-w-7xl mx-auto">

          {/* 텍스트 */}
          <div className="md:col-span-5 flex flex-col justify-center">
            <h2 className="font-headline text-4xl md:text-5xl font-extrabold text-on-surface mb-8 tracking-tighter leading-none">
              The Digital <br />Curator.
            </h2>
            <div className="w-16 h-1 bg-primary mb-12" />
            <p className="text-on-surface-variant leading-loose text-lg mb-8">
              In an era of infinite imagery, IMAGE PARTNERS stands as a filter
              for quality. We are not a warehouse; we are a gallery. Our mission
              is to provide editors and creators with more than just assets—we
              provide context, narrative, and soul.
            </p>
          </div>

          {/* 이미지 + 플로팅 카드 */}
          <div className="md:col-span-7">
            <div className="relative group">
              <div className="aspect-[16/10] overflow-hidden shadow-ghost">
                <Image
                  src="https://picsum.photos/seed/editorial/800/500"
                  alt="Editorial team working"
                  width={800}
                  height={500}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  unoptimized
                />
              </div>
              {/* 플로팅 카드 */}
              <div className="absolute -bottom-8 -left-8 md:bottom-12 md:-left-12 bg-surface-container-lowest p-8 shadow-ghost max-w-sm hidden sm:block">
                <h3 className="font-headline font-bold text-xl mb-4 text-on-surface">
                  Our Core Expertise
                </h3>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Specializing in high-resolution archival restoration and
                  contemporary editorial licensing for international print media.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 3. Values ───────────────────────────── */}
      <section className="py-24 px-8 md:px-24 bg-surface-container-low">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {VALUES.map(({ icon, title, desc }) => (
            <div
              key={title}
              className="bg-surface-container-lowest p-12 shadow-ghost flex flex-col items-start gap-6"
            >
              <span className="material-symbols-outlined text-4xl text-primary">
                {icon}
              </span>
              <h4 className="font-headline text-2xl font-bold tracking-tight text-on-surface">
                {title}
              </h4>
              <p className="text-on-surface-variant leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── 4. Timeline ─────────────────────────── */}
      <section className="py-32 px-8 md:px-24 bg-surface">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="font-headline text-4xl font-extrabold mb-4 uppercase tracking-widest text-on-surface">
              The Legacy
            </h2>
            <p className="text-on-surface-variant">
              Three decades of visual storytelling.
            </p>
          </div>

          <div className="space-y-24">
            {TIMELINE.map(({ year, title, desc, img, alt, reverse }) => (
              <div
                key={year}
                className={`flex flex-col ${reverse ? "md:flex-row-reverse" : "md:flex-row"} items-center gap-12 group`}
              >
                {/* 텍스트 */}
                <div className={`md:w-1/2 ${reverse ? "md:text-left" : "md:text-right"}`}>
                  <span className="font-headline text-6xl font-black text-primary/10 group-hover:text-primary/20 transition-colors">
                    {year}
                  </span>
                  <h5 className="text-2xl font-bold mt-2 text-on-surface">{title}</h5>
                  <p className="text-on-surface-variant mt-4 leading-relaxed">{desc}</p>
                </div>

                {/* 중앙 도트 */}
                <div className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center shrink-0">
                  <div className="w-4 h-4 bg-primary rounded-full" />
                </div>

                {/* 이미지 */}
                <div className="md:w-1/2 aspect-video overflow-hidden shadow-ghost">
                  <Image
                    src={img}
                    alt={alt}
                    width={800}
                    height={450}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 5. Partners ─────────────────────────── */}
      <section className="py-24 bg-surface-container-high px-8">
        <div className="max-w-7xl mx-auto">
          <h3 className="text-center font-headline text-sm font-bold uppercase tracking-[0.3em] text-outline mb-16">
            Trusted by industry leaders
          </h3>
          <div className="flex flex-wrap justify-center items-center gap-16 md:gap-24 opacity-60">
            {PARTNERS.map((name) => (
              <span
                key={name}
                className="font-headline text-2xl font-extrabold text-on-surface tracking-tighter"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 6. CTA ──────────────────────────────── */}
      <section className="py-32 px-8 bg-primary">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-headline text-4xl md:text-6xl font-extrabold text-white mb-8 tracking-tight">
            READY TO DEFINE YOUR <br />
            VISUAL NARRATIVE?
          </h2>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/library"
              className="px-10 py-5 bg-white text-primary font-bold rounded shadow-ghost hover:bg-zinc-100 transition-colors uppercase tracking-widest text-sm"
            >
              Browse our library
            </Link>
            <button className="px-10 py-5 border border-white/30 text-white font-bold rounded hover:bg-white/10 transition-colors uppercase tracking-widest text-sm">
              Contact sales
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
