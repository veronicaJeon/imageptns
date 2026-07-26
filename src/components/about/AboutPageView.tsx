"use client";

import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { NoticePopup } from "@/components/ui/NoticePopup";
import { useLang } from "@/lib/i18n/store";
import type {
  AboutImageSource,
  AboutPageContent,
  AboutPageLocale,
} from "@/lib/about/content";

function ImageCredit({
  source,
  className,
}: {
  source: AboutImageSource;
  className: string;
}) {
  if (!source.credit) return null;
  return (
    <span className={className}>
      Photo: {source.credit}
      {source.licenseLabel && (
        <>
          {" · "}
          {source.licenseUrl ? (
            <a
              href={source.licenseUrl}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              {source.licenseLabel}
            </a>
          ) : source.licenseLabel}
        </>
      )}
    </span>
  );
}

export function AboutPageView({
  content,
  langOverride,
  showNoticePopup = true,
}: {
  content: AboutPageContent;
  langOverride?: AboutPageLocale;
  showNoticePopup?: boolean;
}) {
  const { lang } = useLang();
  const activeLang = langOverride ?? lang;
  const copy = content.locales[activeLang];
  const desk = copy.curation;

  return (
    <>
      {showNoticePopup && <NoticePopup />}

      <section className="relative flex min-h-[720px] w-full items-center overflow-hidden px-8 md:px-24">
        <div className="absolute inset-0 z-0">
          <Image
            src={content.images.hero}
            alt="Image Partners"
            fill
            className="object-cover grayscale brightness-50"
            priority
            unoptimized
          />
          <ImageCredit
            source={content.imageSources.hero}
            className="absolute bottom-3 right-4 text-[10px] text-white/65"
          />
        </div>

        <div className="relative z-10 max-w-5xl">
          {copy.hero.badge && (
            <Badge variant="accent" className="mb-6">
              {copy.hero.badge}
            </Badge>
          )}
          <h1 className="mb-8 font-headline text-5xl font-extrabold leading-tight tracking-tighter text-white md:text-8xl">
            {copy.hero.headline1}
            <br />
            <span className="text-primary-container">{copy.hero.headline2}</span>
          </h1>
          <p className="max-w-2xl text-lg font-light leading-relaxed text-white md:text-xl">
            {copy.hero.description}
          </p>
        </div>
      </section>

      <section className="bg-surface px-8 py-32 md:px-24">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-16 md:grid-cols-12">
          <div className="flex flex-col justify-center md:col-span-5">
            <h2 className="mb-8 font-headline text-4xl font-extrabold leading-none tracking-tighter text-on-surface md:text-5xl">
              {copy.about.headline1}
              <br />
              {copy.about.headline2}
            </h2>
            <div className="mb-12 h-1 w-16 bg-primary" />
            <p className="text-lg leading-loose text-on-surface-variant">{copy.about.body}</p>
          </div>

          <div className="md:col-span-7">
            <div className="relative aspect-[16/10] overflow-hidden shadow-ghost">
              <Image
                src={content.images.editorial}
                alt="Editorial image curation"
                width={800}
                height={500}
                className="h-full w-full object-cover"
                unoptimized
              />
              <ImageCredit
                source={content.imageSources.editorial}
                className="absolute bottom-2 right-3 rounded bg-black/45 px-2 py-1 text-[10px] text-white/80"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface-container-low px-6 py-24 md:px-24">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[minmax(0,0.86fr)_minmax(520px,1.14fr)] lg:items-center">
          <div className="max-w-xl">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.26em] text-primary">
              {desk.kicker}
            </p>
            <h2 className="font-headline text-3xl font-extrabold leading-tight tracking-tight text-on-surface md:text-5xl">
              {desk.title}
            </h2>
            <p className="mt-7 text-base leading-8 text-on-surface-variant md:text-lg">
              {desk.body}
            </p>
            <div className="mt-10 border-l-2 border-primary pl-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-outline">
                {desk.noteLabel}
              </p>
              <p className="mt-3 text-sm leading-7 text-on-surface">
                {desk.note}
              </p>
            </div>
          </div>

          <div className="overflow-hidden border border-outline-variant/30 bg-surface-container-lowest shadow-ghost">
            <div className="grid lg:grid-cols-[0.92fr_1.08fr]">
              <div className="relative min-h-[340px] bg-surface-container-low lg:min-h-[560px]">
                <Image
                  src={content.images.desk}
                  alt={desk.previewLabel}
                  fill
                  className="object-cover grayscale"
                  unoptimized
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/70">
                    {desk.previewLabel}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {desk.panelMeta}
                  </p>
                  <ImageCredit
                    source={content.imageSources.desk}
                    className="mt-2 block text-[10px] text-white/70"
                  />
                </div>
              </div>

              <div className="p-5 md:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-outline">
                      {desk.panelTitle}
                    </p>
                    <p className="mt-2 font-headline text-2xl font-extrabold tracking-tight text-on-surface">
                      {desk.panelMeta}
                    </p>
                  </div>
                  <span className="inline-flex h-7 items-center rounded-full border border-primary/20 bg-primary/10 px-3 text-[10px] font-bold text-primary">
                    {desk.reviewed}
                  </span>
                </div>

                <div className="mt-6 divide-y divide-outline-variant/30 border-y border-outline-variant/30">
                  {desk.records.map((record) => (
                    <div key={record.label} className="grid gap-2 py-4 sm:grid-cols-[112px_minmax(0,1fr)]">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">
                        {record.label}
                      </p>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-on-surface">
                          {record.value}
                        </p>
                        <p className="mt-1 text-xs leading-6 text-on-surface-variant">
                          {record.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="mt-6 text-xs leading-6 text-outline">
                  {desk.panelFooter}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-primary px-8 py-32">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-8 font-headline text-3xl font-extrabold leading-tight tracking-tight text-white md:text-5xl">
            {copy.cta.headline1}
            <br />
            {copy.cta.headline2}
          </h2>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/library"
              className="rounded bg-white px-10 py-5 text-sm font-bold uppercase tracking-widest text-primary shadow-ghost transition-colors hover:bg-zinc-100"
            >
              {copy.cta.browse}
            </Link>
            <Link
              href="/contact"
              className="rounded border border-white/30 px-10 py-5 text-sm font-bold uppercase tracking-widest text-white transition-colors hover:bg-white/10"
            >
              {copy.cta.contact}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
