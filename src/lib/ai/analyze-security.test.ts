import { describe, expect, it } from "vitest";

import {
  MAX_AI_ANALYZE_REQUEST_BYTES,
  normalizePositiveLimit,
  parseAiImageInput,
  requestBodyTooLarge,
} from "./analyze-security";

describe("AI analyze request security", () => {
  it("accepts only supported base64 image data URLs", () => {
    expect(parseAiImageInput("data:image/jpeg;base64,YWJj")).toEqual({
      dataUrl: "data:image/jpeg;base64,YWJj",
      base64Data: "YWJj",
      mimeType: "image/jpeg",
    });
    expect(() => parseAiImageInput("data:image/tiff;base64,YWJj")).toThrow(
      "Unsupported AI image type",
    );
    expect(() => parseAiImageInput("https://example.com/image.jpg")).toThrow(
      "valid base64 data URL",
    );
  });

  it("rejects oversized requests from content-length before parsing JSON", () => {
    expect(requestBodyTooLarge(String(MAX_AI_ANALYZE_REQUEST_BYTES + 1))).toBe(true);
    expect(requestBodyTooLarge(String(MAX_AI_ANALYZE_REQUEST_BYTES))).toBe(false);
    expect(requestBodyTooLarge(null)).toBe(false);
  });

  it("normalizes configurable quota limits", () => {
    expect(normalizePositiveLimit("120", 60)).toBe(120);
    expect(normalizePositiveLimit("0", 60)).toBe(60);
    expect(normalizePositiveLimit("invalid", 60)).toBe(60);
  });
});
