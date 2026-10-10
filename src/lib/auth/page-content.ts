export type AuthPageKey = "login" | "signup";
export type AuthPageLocale = "ko" | "en";

export interface AuthPagePanelContent {
  backgroundImageUrl: string;
  backgroundImageAlt: string;
  locales: Record<AuthPageLocale, { headline: string; comment: string }>;
}

export interface AuthPageContent {
  pages: Record<AuthPageKey, AuthPagePanelContent>;
}

const DEFAULT_PANEL = {
  backgroundImageUrl: "",
  backgroundImageAlt: "",
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
  return {
    backgroundImageUrl: isSafeAuthBackgroundUrl(backgroundImageUrl) ? backgroundImageUrl : fallback.backgroundImageUrl,
    backgroundImageAlt: optionalText(source.backgroundImageAlt, 160),
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
