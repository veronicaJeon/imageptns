import { describe, expect, it } from "vitest";
import { DEFAULT_AUTH_PAGE_CONTENT, isSafeAuthBackgroundUrl, normalizeAuthPageContent } from "./page-content";

describe("auth page content", () => {
  it("keeps login and signup content independent by locale", () => {
    const content = normalizeAuthPageContent({ pages: { login: { locales: { ko: { headline: "로그인 문구", comment: "로그인 설명" } } } } });
    expect(content.pages.login.locales.ko.headline).toBe("로그인 문구");
    expect(content.pages.signup.locales.en.headline).toBe(DEFAULT_AUTH_PAGE_CONTENT.pages.signup.locales.en.headline);
  });

  it("allows public URLs while rejecting private storage and executable URLs", () => {
    expect(isSafeAuthBackgroundUrl("https://cdn.example.com/auth.webp")).toBe(true);
    expect(isSafeAuthBackgroundUrl("/brand/auth.webp")).toBe(true);
    expect(isSafeAuthBackgroundUrl("https://x/storage/v1/object/sign/images-original/a.jpg")).toBe(false);
    expect(isSafeAuthBackgroundUrl("javascript:alert(1)")).toBe(false);
  });

  it("falls back safely for malformed content", () => {
    const content = normalizeAuthPageContent({ pages: { login: { backgroundImageUrl: "data:image/png;base64,bad" } } });
    expect(content.pages.login.backgroundImageUrl).toBe("");
  });

  it("keeps a valid library derivative reference", () => {
    const content = normalizeAuthPageContent({ pages: { login: {
      backgroundImageUrl: "https://cdn.example.com/storage/v1/object/public/site-assets/auth/login/image-abc.webp",
      backgroundImageSource: { source: "library", imageId: "image", derivedPath: "auth/login/image-abc.webp", credit: "작가" },
    } } });
    expect(content.pages.login.backgroundImageSource).toMatchObject({ source: "library", imageId: "image", derivedPath: "auth/login/image-abc.webp", credit: "작가" });
  });
});
