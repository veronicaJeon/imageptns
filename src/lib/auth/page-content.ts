export type AuthPageKey = "login" | "signup";
export type AuthPageLocale = "ko" | "en";

export interface AuthPagePanelContent {
  backgroundImageUrl: string;
  backgroundImageAlt: string;
  backgroundImageSource: AuthPageImageSource;
  locales: Record<AuthPageLocale, { headline: string; comment: string }>;
}

export interface AuthPageImageSource {
  source: "external" | "library";
  imageId: string | null;
  derivedPath: string | null;
  credit: string | null;
  licenseCode: string | null;
  licenseLabel: string | null;
  licenseUrl: string | null;
}

export interface AuthPageContent {
  pages: Record<AuthPageKey, AuthPagePanelContent>;
}

const DEFAULT_PANEL: Omit<AuthPagePanelContent, "locales"> = {
  backgroundImageUrl: "",
  backgroundImageAlt: "",
  backgroundImageSource: { source: "external", imageId: null, derivedPath: null, credit: null, licenseCode: null, licenseLabel: null, licenseUrl: null },
};

export const DEFAULT_AUTH_PAGE_CONTENT: AuthPageContent = {
  pages: {
    login: {
      ...DEFAULT_PANEL,
      locales: {
        ko: { headline: "필요한 이미지를 더 정확하게.", comment: "검증된 이미지와 이용 조건을 한곳에서 확인하세요." },
        en: { headline: "Find the right image with confidence.", comment: "Discover verified imagery and clear usage terms in one place." },
      },
    },
    signup: {
      ...DEFAULT_PANEL,
      locales: {
        ko: { headline: "이미지로 연결되는 새로운 협업.", comment: "구매자와 사진작가를 위한 이미지파트너스에 참여하세요." },
        en: { headline: "A better way to work through images.", comment: "Join Image Partners as a buyer or photographer." },
      },
    },
  },
};

function text(value: unknown, fallback: string, max: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;
}

function optionalText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function isSafeAuthBackgroundUrl(value: string) {
  if (!value) return true;
  const normalized = value.toLowerCase();
  return (value.startsWith("https://") || value.startsWith("http://") || value.startsWith("/"))
    && !normalized.includes("/storage/v1/object/sign/")
    && !normalized.includes("/images-original/")
    && !normalized.includes("/images-full/")
    && !normalized.startsWith("javascript:")
    && !normalized.startsWith("data:");
}

function normalizePanel(value: unknown, fallback: AuthPagePanelContent): AuthPagePanelContent {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const locales = source.locales && typeof source.locales === "object"
    ? source.locales as Record<string, unknown>
    : {};
  const backgroundImageUrl = optionalText(source.backgroundImageUrl, 1000);
  const rawImageSource = source.backgroundImageSource && typeof source.backgroundImageSource === "object"
    ? source.backgroundImageSource as Record<string, unknown>
    : {};
  const backgroundImageSource: AuthPageImageSource = rawImageSource.source === "library"
    && typeof rawImageSource.imageId === "string" && rawImageSource.imageId.trim()
    && typeof rawImageSource.derivedPath === "string" && rawImageSource.derivedPath.startsWith("auth/")
    ? {
        source: "library",
        imageId: rawImageSource.imageId.trim(),
        derivedPath: rawImageSource.derivedPath.trim(),
        credit: typeof rawImageSource.credit === "string" ? rawImageSource.credit.trim().slice(0, 120) || null : null,
        licenseCode: typeof rawImageSource.licenseCode === "string" ? rawImageSource.licenseCode.trim().slice(0, 40) || null : null,
        licenseLabel: typeof rawImageSource.licenseLabel === "string" ? rawImageSource.licenseLabel.trim().slice(0, 80) || null : null,
        licenseUrl: typeof rawImageSource.licenseUrl === "string" && isSafeAuthBackgroundUrl(rawImageSource.licenseUrl) ? rawImageSource.licenseUrl.trim().slice(0, 500) : null,
      }
    : DEFAULT_PANEL.backgroundImageSource;
  return {
    backgroundImageUrl: isSafeAuthBackgroundUrl(backgroundImageUrl) ? backgroundImageUrl : fallback.backgroundImageUrl,
    backgroundImageAlt: optionalText(source.backgroundImageAlt, 160),
    backgroundImageSource,
    locales: Object.fromEntries((["ko", "en"] as const).map((locale) => {
      const localeSource = locales[locale] && typeof locales[locale] === "object"
        ? locales[locale] as Record<string, unknown>
        : {};
      return [locale, {
        headline: text(localeSource.headline, fallback.locales[locale].headline, 160),
        comment: text(localeSource.comment, fallback.locales[locale].comment, 300),
      }];
    })) as AuthPagePanelContent["locales"],
  };
}

export function normalizeAuthPageContent(value: unknown): AuthPageContent {
  const root = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const pages = root.pages && typeof root.pages === "object" ? root.pages as Record<string, unknown> : {};
  return {
    pages: {
      login: normalizePanel(pages.login, DEFAULT_AUTH_PAGE_CONTENT.pages.login),
      signup: normalizePanel(pages.signup, DEFAULT_AUTH_PAGE_CONTENT.pages.signup),
    },
  };
}
