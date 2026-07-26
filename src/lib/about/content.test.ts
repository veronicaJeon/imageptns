import { describe, expect, it } from "vitest";
import {
  DEFAULT_ABOUT_PAGE_CONTENT,
  normalizeAboutPageContent,
} from "./content";

describe("normalizeAboutPageContent", () => {
  it("keeps legacy content compatible by defaulting image provenance to external", () => {
    const normalized = normalizeAboutPageContent({
      images: DEFAULT_ABOUT_PAGE_CONTENT.images,
      locales: DEFAULT_ABOUT_PAGE_CONTENT.locales,
    });

    expect(normalized.imageSources.hero).toEqual({
      source: "external",
      imageId: null,
      derivedPath: null,
      credit: null,
    });
  });

  it("preserves a complete library derivative reference and trims its credit", () => {
    const normalized = normalizeAboutPageContent({
      ...DEFAULT_ABOUT_PAGE_CONTENT,
      imageSources: {
        ...DEFAULT_ABOUT_PAGE_CONTENT.imageSources,
        hero: {
          source: "library",
          imageId: " image-id ",
          derivedPath: "about/hero/image-id-hash.webp",
          credit: " Photographer ",
        },
      },
    });

    expect(normalized.imageSources.hero).toEqual({
      source: "library",
      imageId: "image-id",
      derivedPath: "about/hero/image-id-hash.webp",
      credit: "Photographer",
    });
  });

  it("rejects incomplete library provenance instead of trusting a public URL", () => {
    const normalized = normalizeAboutPageContent({
      ...DEFAULT_ABOUT_PAGE_CONTENT,
      imageSources: {
        hero: { source: "library", imageId: "image-id", derivedPath: "../original.jpg" },
      },
    });

    expect(normalized.imageSources.hero.source).toBe("external");
  });

  it("never accepts an original-bucket URL as a display image", () => {
    const normalized = normalizeAboutPageContent({
      ...DEFAULT_ABOUT_PAGE_CONTENT,
      images: {
        ...DEFAULT_ABOUT_PAGE_CONTENT.images,
        hero: "https://project.supabase.co/storage/v1/object/sign/images-original/user/photo.jpg?token=secret",
      },
    });

    expect(normalized.images.hero).toBe(DEFAULT_ABOUT_PAGE_CONTENT.images.hero);
  });
});
