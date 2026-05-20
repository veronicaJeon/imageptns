import { describe, expect, it } from "vitest";

import {
  buildSiteUrl,
  getCanonicalRedirectUrl,
  getCanonicalRedirectOrigin,
  getSafeRelativePath,
} from "./canonical";

describe("canonical routing helpers", () => {
  it("redirects the Vercel deployment host to the public www domain", () => {
    const redirect = getCanonicalRedirectUrl(
      "https://imageptns.vercel.app/api/auth/callback?code=abc&next=/dashboard"
    );

    expect(redirect?.toString()).toBe(
      "https://www.imagepartners.kr/api/auth/callback?code=abc&next=/dashboard"
    );
  });

  it("redirects the bare public domain to the www domain", () => {
    const redirect = getCanonicalRedirectUrl(
      "https://imagepartners.kr/login?next=/dashboard"
    );

    expect(redirect?.toString()).toBe(
      "https://www.imagepartners.kr/login?next=/dashboard"
    );
  });

  it("does not redirect requests that are already on the canonical domain", () => {
    expect(getCanonicalRedirectUrl("https://www.imagepartners.kr/login")).toBe(
      null
    );
  });

  it("canonicalizes callback redirect origins", () => {
    expect(getCanonicalRedirectOrigin("https://imageptns.vercel.app")).toBe(
      "https://www.imagepartners.kr"
    );
    expect(getCanonicalRedirectOrigin("https://imagepartners.kr")).toBe(
      "https://www.imagepartners.kr"
    );
  });

  it("keeps OAuth next values on local relative paths only", () => {
    expect(getSafeRelativePath("/dashboard", "/")).toBe("/dashboard");
    expect(getSafeRelativePath("https://evil.example", "/dashboard")).toBe(
      "/dashboard"
    );
    expect(getSafeRelativePath("//evil.example", "/dashboard")).toBe(
      "/dashboard"
    );
  });

  it("builds client redirect URLs from canonicalized origins", () => {
    expect(buildSiteUrl("/api/auth/callback", "https://imageptns.vercel.app")).toBe(
      "https://www.imagepartners.kr/api/auth/callback"
    );
  });
});
