import { describe, expect, it } from "vitest";
import {
  MAX_UPLOAD_FILE_BYTES,
  normalizeUploadFileSize,
  uploadPathBelongsToUser,
  uploadSessionExpiresAt,
  validateImageMetadata,
} from "./security";

describe("upload security", () => {
  it("accepts only a single object directly under the current user folder", () => {
    expect(uploadPathBelongsToUser("user-1/file.jpg", "user-1")).toBe(true);
    expect(uploadPathBelongsToUser("user-2/file.jpg", "user-1")).toBe(false);
    expect(uploadPathBelongsToUser("user-1/nested/file.jpg", "user-1")).toBe(false);
    expect(uploadPathBelongsToUser("user-1/../user-2/file.jpg", "user-1")).toBe(false);
    expect(uploadPathBelongsToUser("/user-1/file.jpg", "user-1")).toBe(false);
  });

  it("rejects missing, fractional, and oversized declared file sizes", () => {
    expect(normalizeUploadFileSize(1)).toBe(1);
    expect(normalizeUploadFileSize(MAX_UPLOAD_FILE_BYTES)).toBe(MAX_UPLOAD_FILE_BYTES);
    expect(normalizeUploadFileSize(0)).toBeNull();
    expect(normalizeUploadFileSize(1.5)).toBeNull();
    expect(normalizeUploadFileSize(MAX_UPLOAD_FILE_BYTES + 1)).toBeNull();
  });

  it("bounds decoded image dimensions and supported formats", () => {
    expect(validateImageMetadata({ format: "jpeg", width: 4_000, height: 3_000 }).ok).toBe(true);
    expect(validateImageMetadata({ format: "gif", width: 4_000, height: 3_000 }).ok).toBe(false);
    expect(validateImageMetadata({ format: "jpeg", width: 20_000, height: 20_000 }).ok).toBe(false);
  });

  it("creates a short-lived upload session", () => {
    expect(uploadSessionExpiresAt(new Date("2026-07-29T00:00:00.000Z")))
      .toBe("2026-07-29T00:20:00.000Z");
  });
});
