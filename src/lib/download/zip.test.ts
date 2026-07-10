import { describe, expect, it } from "vitest";
import { createStoredZip, sanitizeZipFilename, uniqueZipFilename } from "./zip";

describe("download zip helpers", () => {
  it("sanitizes unsafe filenames while preserving useful extensions", () => {
    expect(sanitizeZipFilename("../IP-00001 / 원본?.jpg", "fallback.jpg")).toBe("IP-00001_원본.jpg");
    expect(sanitizeZipFilename("", "fallback.jpg")).toBe("fallback.jpg");
  });

  it("deduplicates filenames before adding them to a zip archive", () => {
    const used = new Set<string>();

    expect(uniqueZipFilename("photo.jpg", used)).toBe("photo.jpg");
    expect(uniqueZipFilename("photo.jpg", used)).toBe("photo-2.jpg");
    expect(uniqueZipFilename("photo.jpg", used)).toBe("photo-3.jpg");
  });

  it("creates a valid stored zip archive containing every file", () => {
    const zip = createStoredZip([
      { name: "one.txt", data: Buffer.from("hello") },
      { name: "two.txt", data: Buffer.from("world") },
    ]);

    expect(zip.subarray(0, 4).toString("hex")).toBe("504b0304");
    expect(zip.includes(Buffer.from("one.txt"))).toBe(true);
    expect(zip.includes(Buffer.from("two.txt"))).toBe(true);
    expect(zip.subarray(zip.length - 22, zip.length - 18).toString("hex")).toBe("504b0506");
  });
});
