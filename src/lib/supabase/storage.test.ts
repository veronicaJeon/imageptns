import { describe, expect, it } from "vitest";
import { thumbnailUrlFromPreviewUrl } from "./storage";

describe("thumbnailUrlFromPreviewUrl", () => {
  it("routes public preview images through a versioned watermarked thumbnail proxy", () => {
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
