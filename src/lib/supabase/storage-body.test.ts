import { describe, expect, it } from "vitest";
import { hasJpegSignature, storageBinaryBody } from "./storage-body";

describe("storageBinaryBody", () => {
  it("preserves binary bytes including an invalid UTF-8 JPEG signature", () => {
    const source = Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x7f, 0x80]);
    const body = storageBinaryBody(source);

    expect(Array.from(new Uint8Array(body))).toEqual(Array.from(source));
  });

  it("copies only the visible byte range", () => {
    const backing = Uint8Array.from([1, 2, 3, 4, 5]);
    const view = backing.subarray(1, 4);

    expect(Array.from(new Uint8Array(storageBinaryBody(view)))).toEqual([2, 3, 4]);
  });

  it("distinguishes valid JPEG bytes from UTF-8 replacement corruption", () => {
    expect(hasJpegSignature(Uint8Array.from([0xff, 0xd8, 0xff, 0xe1]))).toBe(true);
    expect(hasJpegSignature(Uint8Array.from([0xef, 0xbf, 0xbd, 0xef]))).toBe(false);
  });
});
