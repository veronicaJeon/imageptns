import { describe, expect, it } from "vitest";
import { normalizePhoneNumber, normalizePrimaryActivityRegions } from "./contact";

describe("normalizePhoneNumber", () => {
  it("normalizes blank phone numbers to null", () => {
    expect(normalizePhoneNumber("")).toBeNull();
    expect(normalizePhoneNumber("   ")).toBeNull();
    expect(normalizePhoneNumber(null)).toBeNull();
  });

  it("keeps valid local and international phone number formats", () => {
    expect(normalizePhoneNumber(" 010-1234-5678 ")).toBe("010-1234-5678");
    expect(normalizePhoneNumber("+82 10 1234 5678")).toBe("+82 10 1234 5678");
    expect(normalizePhoneNumber("(02) 1234.5678")).toBe("(02) 1234.5678");
  });

  it("rejects phone numbers with invalid characters or implausible digit counts", () => {
    expect(() => normalizePhoneNumber("010-call-me")).toThrow("phone_number");
    expect(() => normalizePhoneNumber("12345")).toThrow("phone_number");
    expect(() => normalizePhoneNumber("+82 +10 1234 5678")).toThrow("phone_number");
  });
});

describe("normalizePrimaryActivityRegions", () => {
  it("normalizes empty region values to an empty list", () => {
    expect(normalizePrimaryActivityRegions(null)).toEqual([]);
    expect(normalizePrimaryActivityRegions(["", "   "])).toEqual([]);
  });

  it("trims, de-duplicates, and preserves multiple region names", () => {
    expect(normalizePrimaryActivityRegions([" Seoul ", "Busan", "seoul", "Jeju Island"])).toEqual([
      "Seoul",
      "Busan",
      "Jeju Island",
    ]);
  });

  it("accepts comma or newline separated region strings", () => {
    expect(normalizePrimaryActivityRegions("Seoul, Busan\nJeju Island")).toEqual([
      "Seoul",
      "Busan",
      "Jeju Island",
    ]);
  });

  it("rejects non-string, too-long, or oversized region lists", () => {
    expect(() => normalizePrimaryActivityRegions(["Seoul", 123])).toThrow("primary_activity_regions");
    expect(() => normalizePrimaryActivityRegions(["S".repeat(81)])).toThrow("primary_activity_regions");
    expect(() => normalizePrimaryActivityRegions(Array.from({ length: 13 }, (_, index) => `Region ${index}`))).toThrow("primary_activity_regions");
  });
});
