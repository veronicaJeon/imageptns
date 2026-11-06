import { describe, expect, it } from "vitest";
import {
  imageStorageObjectKey,
  imageStorageProvider,
  isPublicR2PreviewPath,
  r2ImagePath,
  r2PreviewUrl,
} from "./image-path";

describe("image storage paths", () => {
  it("keeps legacy paths on Supabase and marks new R2 paths", () => {
    expect(imageStorageProvider("user/photo.jpg")).toBe("supabase");
    expect(imageStorageProvider("r2/user/photo.jpg")).toBe("r2");
    expect(imageStorageProvider("thumbs/r2/user/photo.jpg")).toBe("r2");
    expect(imageStorageProvider(null)).toBe("supabase");
  });

  it("creates owner-scoped R2 paths and logical bucket keys", () => {
    expect(r2ImagePath("user-1", "photo.jpg")).toBe("r2/user-1/photo.jpg");
    expect(imageStorageObjectKey("images-original", "r2/user-1/photo.jpg"))
      .toBe("images-original/r2/user-1/photo.jpg");
  });

  it("encodes every public preview path segment", () => {
    expect(r2PreviewUrl("r2/user 1/photo #1.jpg"))
      .toBe("/api/image-assets/r2/user%201/photo%20%231.jpg");
  });

  it("accepts only self-contained R2 preview paths", () => {
    expect(isPublicR2PreviewPath("r2/user/photo.jpg")).toBe(true);
    expect(isPublicR2PreviewPath("thumbs/r2/user/photo.jpg")).toBe(true);
    expect(isPublicR2PreviewPath("user/photo.jpg")).toBe(false);
    expect(isPublicR2PreviewPath("r2/user/../photo.jpg")).toBe(false);
  });
});
