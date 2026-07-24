"use client";

import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { NoticePopup } from "@/components/ui/NoticePopup";
import { useLang } from "@/lib/i18n/store";

const IMAGES = {
  hero: "https://picsum.photos/seed/lobby/1920/870",
  editorial: "https://picsum.photos/seed/editorial/800/500",
  desk: "https://picsum.photos/seed/curation-desk/960/1100",
};

const CURATION_DESK_COPY = {
  ko: {
    kicker: "CURATION DESK",
    title: "검증은 문장보다 과정으로 증명합니다.",
    body: "출처와 권리, 이미지가 놓일 문맥까지 확인합니다. 이미지파트너스는 보기 좋은 이미지를 많이 보여주는 것보다, 프로젝트에 실제로 사용할 수 있는 컷을 정확하게 제안하는 일을 우선합니다.",
    panelTitle: "Project fit review",
    panelMeta: "IP-EDIT-042",
    previewLabel: "Candidate image",
    reviewed: "검토 완료",
    noteLabel: "Editor's note",
    note: "이 컷은 단순한 배경 이미지가 아니라, 장면의 시간대와 정서를 설명할 수 있는 이미지입니다.",
    panelFooter: "출처, 권리, 캡션, 프로젝트 적합성을 함께 검토한 뒤 이미지를 추천합니다.",
    records: [
      { label: "출처 확인", value: "완료", detail: "촬영자와 제공처 메타데이터를 대조했습니다." },
      { label: "사용 범위", value: "라이선스 확인", detail: "프로젝트 성격에 맞는 사용 조건을 확인합니다." },
      { label: "캡션", value: "맥락 검토", detail: "이미지 설명이 과장 없이 장면을 설명하는지 봅니다." },
      { label: "추천 사유", value: "프로젝트 톤과 부합", detail: "분위기, 시점, 정보 밀도를 함께 판단합니다." },
    ],
  },
  en: {
    kicker: "CURATION DESK",
    title: "Verification is proven through process, not slogans.",
    body: "We review source, rights, and the context in which an image will appear. Image Partners focuses less on showing more attractive images and more on recommending cuts that can actually work for the project.",
    panelTitle: "Project fit review",
    panelMeta: "IP-EDIT-042",
    previewLabel: "Candidate image",
    reviewed: "REVIEWED",
    noteLabel: "Editor's note",
    note: "This cut is not just a background image. It can explain the time, mood, and emotional direction of the scene.",
    panelFooter: "Source, rights, caption, and project fit are reviewed together before an image is recommended.",
    records: [
      { label: "Source", value: "Cleared", detail: "Photographer and supplier metadata are checked together." },
      { label: "Usage", value: "License reviewed", detail: "Usage conditions are matched to the project type." },
      { label: "Caption", value: "Context checked", detail: "Descriptions are reviewed for accuracy and restraint." },
      { label: "Fit", value: "Aligned with tone", detail: "Mood, perspective, and information density are considered together." },
    ],
  },
} as const;

export default function AboutPage() {
  const { lang, t } = useLang();
  const h = t.home;
  const desk = CURATION_DESK_COPY[lang];

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
          <p className="max-w-2xl text-lg font-light leading-relaxed text-white md:text-xl">
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
                  src={IMAGES.desk}
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

      {/*
        Timeline, founding-date, restoration mastery, and partner-logo sections are hidden
        until the company history and trust-copy claims are verified for public launch.
      */}

      <section className="bg-primary px-8 py-32">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-8 font-headline text-3xl font-extrabold leading-tight tracking-tight text-white md:text-5xl">
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
