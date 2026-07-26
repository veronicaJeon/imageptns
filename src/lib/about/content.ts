export type AboutPageLocale = "ko" | "en";
export type AboutImageSlot = "hero" | "editorial" | "desk";

export interface AboutImageSource {
  source: "external" | "library";
  imageId: string | null;
  derivedPath: string | null;
  credit: string | null;
  licenseCode: string | null;
  licenseLabel: string | null;
  licenseUrl: string | null;
}

export interface AboutPageRecord {
  label: string;
  value: string;
  detail: string;
}

export interface AboutPageLocaleContent {
  hero: {
    badge: string;
    headline1: string;
    headline2: string;
    description: string;
  };
  about: {
    headline1: string;
    headline2: string;
    body: string;
  };
  curation: {
    kicker: string;
    title: string;
    body: string;
    panelTitle: string;
    panelMeta: string;
    previewLabel: string;
    reviewed: string;
    noteLabel: string;
    note: string;
    panelFooter: string;
    records: AboutPageRecord[];
  };
  cta: {
    headline1: string;
    headline2: string;
    browse: string;
    contact: string;
  };
}

export interface AboutPageContent {
  images: {
    hero: string;
    editorial: string;
    desk: string;
  };
  imageSources: Record<AboutImageSlot, AboutImageSource>;
  locales: Record<AboutPageLocale, AboutPageLocaleContent>;
}

const DEFAULT_IMAGES = {
  hero: "https://picsum.photos/seed/lobby/1920/870",
  editorial: "https://picsum.photos/seed/editorial/800/500",
  desk: "https://picsum.photos/seed/curation-desk/960/1100",
};

export const DEFAULT_ABOUT_PAGE_CONTENT: AboutPageContent = {
  images: DEFAULT_IMAGES,
  imageSources: {
    hero: { source: "external", imageId: null, derivedPath: null, credit: null, licenseCode: null, licenseLabel: null, licenseUrl: null },
    editorial: { source: "external", imageId: null, derivedPath: null, credit: null, licenseCode: null, licenseLabel: null, licenseUrl: null },
    desk: { source: "external", imageId: null, derivedPath: null, credit: null, licenseCode: null, licenseLabel: null, licenseUrl: null },
  },
  locales: {
    ko: {
      hero: {
        badge: "",
        headline1: "찾던 이미지,",
        headline2: "그 이상의 맥락.",
        description: "출처와 맥락이 검증된 이미지로 출판·미디어 프로젝트의 완성도를 높입니다.",
      },
      about: {
        headline1: "디지털",
        headline2: "큐레이터.",
        body: "이미지파트너스는 엄격하게 검증된 이미지만을 취급합니다. 온라인상에 떠도는 수많은 데이터 속에서 당신의 프로젝트에 딱 맞는 컷을 제공하려 합니다.",
      },
      curation: {
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
      cta: {
        headline1: "당신의 이야기에 생명력을",
        headline2: "불어넣을 최고의 컷을 찾아드립니다.",
        browse: "라이브러리 둘러보기",
        contact: "문의",
      },
    },
    en: {
      hero: {
        badge: "",
        headline1: "THE IMAGE YOU NEED,",
        headline2: "WITH THE CONTEXT BEHIND IT.",
        description: "Verified source and context help publishing and media projects reach a more complete final form.",
      },
      about: {
        headline1: "The Digital",
        headline2: "Curator.",
        body: "Image Partners handles only carefully verified imagery. From the flood of visual data online, we work to provide the precise cut your project needs.",
      },
      curation: {
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
      cta: {
        headline1: "WE FIND THE CUT",
        headline2: "THAT GIVES YOUR STORY LIFE.",
        browse: "Browse our library",
        contact: "Contact",
      },
    },
  },
};

function safeString(value: unknown, fallback: string, maxLength = 1200) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

function safeOptionalString(value: unknown, fallback: string, maxLength = 1200) {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, maxLength);
}

export function isSafeImageUrl(value: string) {
  return (value.startsWith("https://") || value.startsWith("http://") || value.startsWith("/"))
    && !isOriginalStorageUrl(value);
}

export function isOriginalStorageUrl(value: string) {
  const normalized = value.toLowerCase();
  return normalized.includes("/storage/v1/object/public/images-original/")
    || normalized.includes("/storage/v1/object/sign/images-original/")
    || normalized.includes("/storage/v1/object/authenticated/images-original/")
    || normalized.includes("/storage/v1/object/public/images-full/")
    || normalized.includes("/storage/v1/object/sign/images-full/")
    || normalized.includes("/storage/v1/object/authenticated/images-full/");
}

export function aboutContentContainsOriginalStorageUrl(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const images = (value as Record<string, unknown>).images;
  if (!images || typeof images !== "object") return false;
  return Object.values(images as Record<string, unknown>)
    .some((image) => typeof image === "string" && isOriginalStorageUrl(image));
}

function normalizeImageUrl(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed && isSafeImageUrl(trimmed) ? trimmed : fallback;
}

function normalizeImageSource(value: unknown): AboutImageSource {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  if (
    source.source === "library" &&
    typeof source.imageId === "string" &&
    source.imageId.trim() &&
    typeof source.derivedPath === "string" &&
    source.derivedPath.startsWith("about/")
  ) {
    return {
      source: "library",
      imageId: source.imageId.trim(),
      derivedPath: source.derivedPath.trim(),
      credit: typeof source.credit === "string" ? source.credit.trim().slice(0, 120) || null : null,
      licenseCode: typeof source.licenseCode === "string" ? source.licenseCode.trim().slice(0, 40) || null : null,
      licenseLabel: typeof source.licenseLabel === "string" ? source.licenseLabel.trim().slice(0, 80) || null : null,
      licenseUrl: typeof source.licenseUrl === "string" && isSafeImageUrl(source.licenseUrl)
        ? source.licenseUrl.trim().slice(0, 500)
        : null,
    };
  }
  return {
    source: "external",
    imageId: null,
    derivedPath: null,
    credit: null,
    licenseCode: null,
    licenseLabel: null,
    licenseUrl: null,
  };
}

function normalizeRecords(value: unknown, fallback: AboutPageRecord[]) {
  if (!Array.isArray(value)) return fallback;
  const records = value
    .slice(0, 6)
    .map((record, index) => {
      const fallbackRecord = fallback[index] ?? fallback[0];
      const source = record && typeof record === "object" ? record as Record<string, unknown> : {};
      return {
        label: safeString(source.label, fallbackRecord.label, 80),
        value: safeString(source.value, fallbackRecord.value, 120),
        detail: safeString(source.detail, fallbackRecord.detail, 260),
      };
    });

  return records.length > 0 ? records : fallback;
}

function normalizeLocaleContent(value: unknown, fallback: AboutPageLocaleContent): AboutPageLocaleContent {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const hero = source.hero && typeof source.hero === "object" ? source.hero as Record<string, unknown> : {};
  const about = source.about && typeof source.about === "object" ? source.about as Record<string, unknown> : {};
  const curation = source.curation && typeof source.curation === "object" ? source.curation as Record<string, unknown> : {};
  const cta = source.cta && typeof source.cta === "object" ? source.cta as Record<string, unknown> : {};

  return {
    hero: {
      badge: safeOptionalString(hero.badge, fallback.hero.badge, 60),
      headline1: safeString(hero.headline1, fallback.hero.headline1, 120),
      headline2: safeString(hero.headline2, fallback.hero.headline2, 120),
      description: safeString(hero.description, fallback.hero.description, 260),
    },
    about: {
      headline1: safeString(about.headline1, fallback.about.headline1, 120),
      headline2: safeString(about.headline2, fallback.about.headline2, 120),
      body: safeString(about.body, fallback.about.body, 800),
    },
    curation: {
      kicker: safeString(curation.kicker, fallback.curation.kicker, 60),
      title: safeString(curation.title, fallback.curation.title, 160),
      body: safeString(curation.body, fallback.curation.body, 900),
      panelTitle: safeString(curation.panelTitle, fallback.curation.panelTitle, 80),
      panelMeta: safeString(curation.panelMeta, fallback.curation.panelMeta, 80),
      previewLabel: safeString(curation.previewLabel, fallback.curation.previewLabel, 80),
      reviewed: safeString(curation.reviewed, fallback.curation.reviewed, 60),
      noteLabel: safeString(curation.noteLabel, fallback.curation.noteLabel, 80),
      note: safeString(curation.note, fallback.curation.note, 360),
      panelFooter: safeString(curation.panelFooter, fallback.curation.panelFooter, 360),
      records: normalizeRecords(curation.records, fallback.curation.records),
    },
    cta: {
      headline1: safeString(cta.headline1, fallback.cta.headline1, 160),
      headline2: safeString(cta.headline2, fallback.cta.headline2, 160),
      browse: safeString(cta.browse, fallback.cta.browse, 60),
      contact: safeString(cta.contact, fallback.cta.contact, 60),
    },
  };
}

export function normalizeAboutPageContent(value: unknown): AboutPageContent {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const images = source.images && typeof source.images === "object" ? source.images as Record<string, unknown> : {};
  const imageSources = source.imageSources && typeof source.imageSources === "object"
    ? source.imageSources as Record<string, unknown>
    : {};
  const locales = source.locales && typeof source.locales === "object" ? source.locales as Record<string, unknown> : {};

  return {
    images: {
      hero: normalizeImageUrl(images.hero, DEFAULT_ABOUT_PAGE_CONTENT.images.hero),
      editorial: normalizeImageUrl(images.editorial, DEFAULT_ABOUT_PAGE_CONTENT.images.editorial),
      desk: normalizeImageUrl(images.desk, DEFAULT_ABOUT_PAGE_CONTENT.images.desk),
    },
    imageSources: {
      hero: normalizeImageSource(imageSources.hero),
      editorial: normalizeImageSource(imageSources.editorial),
      desk: normalizeImageSource(imageSources.desk),
    },
    locales: {
      ko: normalizeLocaleContent(locales.ko, DEFAULT_ABOUT_PAGE_CONTENT.locales.ko),
      en: normalizeLocaleContent(locales.en, DEFAULT_ABOUT_PAGE_CONTENT.locales.en),
    },
  };
}
