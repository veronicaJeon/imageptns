import { describe, expect, it } from "vitest";
import { previewUrl, thumbnailUrlFromPreviewUrl } from "./storage";

describe("thumbnailUrlFromPreviewUrl", () => {
  it("serves R2 previews through the same-origin public asset route", () => {
    expect(previewUrl("r2/user/photo.jpg")).toBe("/api/image-assets/r2/user/photo.jpg");
  });

  it("uses the stored R2 thumbnail instead of the transform proxy", () => {
    expect(thumbnailUrlFromPreviewUrl("https://www.imagepartners.kr/api/image-assets/r2/user/photo.jpg"))
      .toBe("https://www.imagepartners.kr/api/image-assets/thumbs/r2/user/photo.jpg");
    expect(thumbnailUrlFromPreviewUrl("/api/image-assets/r2/user/photo.jpg"))
      .toBe("/api/image-assets/thumbs/r2/user/photo.jpg");
  });

  it("routes public preview images through the thumbnail proxy", () => {
    const src = "https://example.supabase.co/storage/v1/object/public/images-preview/user/photo.jpg";
    const url = thumbnailUrlFromPreviewUrl(src, 640, 480);
    const parsed = new URL(url, "https://imagepartners.kr");

    expect(parsed.pathname).toBe("/api/images/thumbnail");
    expect(parsed.searchParams.get("src")).toBe(src);
    expect(parsed.searchParams.get("w")).toBe("640");
    expect(parsed.searchParams.get("h")).toBe("480");
    expect(parsed.searchParams.get("wm")).toBeNull();
  });
});
