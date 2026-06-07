import { describe, expect, it } from "vitest";
import { cartStatementThumbnailUrl, collectCartStatementThumbnailUrls } from "./print";

describe("cart print thumbnails", () => {
  it("builds absolute watermarked thumbnail URLs for print preloading", () => {
    const src = "https://example.supabase.co/storage/v1/object/public/images-preview/user/photo.jpg";
    const url = cartStatementThumbnailUrl(src, "https://imagepartners.kr", 160, 120);
    const parsed = new URL(url);

    expect(parsed.origin).toBe("https://imagepartners.kr");
    expect(parsed.pathname).toBe("/api/images/thumbnail");
    expect(parsed.searchParams.get("src")).toBe(src);
    expect(parsed.searchParams.get("wm")).toBeNull();
  });

  it("does not allow callers to request an unwatermarked print thumbnail", () => {
    const src = "https://example.supabase.co/storage/v1/object/public/images-preview/user/photo.jpg";
    const url = cartStatementThumbnailUrl(src, "https://imagepartners.kr", 160, 120);
    const parsed = new URL(url);

    expect(parsed.searchParams.get("wm")).toBeNull();
  });

  it("collects only printable item thumbnail URLs", () => {
    const urls = collectCartStatementThumbnailUrls(
      [
        { src: "https://example.supabase.co/storage/v1/object/public/images-preview/a.jpg" },
        { src: "" },
      ],
      "https://imagepartners.kr",
    );

    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("/api/images/thumbnail?");
  });
});
