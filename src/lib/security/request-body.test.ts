import { describe, expect, it } from "vitest";
import { boundedMetadata, readBoundedJson, RequestBodyError } from "./request-body";

describe("readBoundedJson", () => {
  it("parses JSON within the limit", async () => {
    const request = new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ ok: true }),
    });
    await expect(readBoundedJson(request, 100)).resolves.toEqual({ ok: true });
  });

  it("rejects oversized bodies", async () => {
    const request = new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ value: "x".repeat(100) }),
    });
    await expect(readBoundedJson(request, 20)).rejects.toMatchObject({
      status: 413,
    });
  });
});

describe("boundedMetadata", () => {
  it("rejects arrays and oversized objects", () => {
    expect(boundedMetadata([])).toEqual({});
    expect(() => boundedMetadata({ value: "x".repeat(100) }, 20)).toThrow(RequestBodyError);
  });
});
