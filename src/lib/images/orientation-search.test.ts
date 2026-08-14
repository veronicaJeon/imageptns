import { describe, expect, it } from "vitest";
import { parseOrientationSearch, resolveOrientationSearch } from "./orientation-search";

describe("parseOrientationSearch", () => {
  it.each([
    ["가로", "landscape"],
    ["세로형", "portrait"],
    ["정사각형", "square"],
    ["horizontal", "landscape"],
    ["vertical", "portrait"],
    ["square", "square"],
    ["landscape", "landscape"],
    ["portrait", "portrait"],
  ] as const)("maps a direction-only search for %s", (query, orientation) => {
    expect(parseOrientationSearch(query)).toEqual({
      textQuery: "",
      orientation,
      conflictingOrientations: false,
    });
  });

  it.each([
    ["제주 가로 사진", "제주", "landscape"],
    ["서울 세로이미지", "서울", "portrait"],
    ["seoul horizontal", "seoul", "landscape"],
    ["vertical Seoul", "Seoul", "portrait"],
    ["Seoul portrait orientation", "Seoul", "portrait"],
  ] as const)("combines text and direction search for %s", (query, textQuery, orientation) => {
    expect(parseOrientationSearch(query)).toEqual({
      textQuery,
      orientation,
      conflictingOrientations: false,
    });
  });

  it("preserves ambiguous English subject words in a longer query", () => {
    expect(parseOrientationSearch("Korean landscape")).toEqual({
      textQuery: "Korean landscape",
      orientation: null,
      conflictingOrientations: false,
    });
    expect(parseOrientationSearch("studio portrait")).toEqual({
      textQuery: "studio portrait",
      orientation: null,
      conflictingOrientations: false,
    });
  });

  it("reports contradictory directions instead of choosing one", () => {
    expect(parseOrientationSearch("가로 세로")).toEqual({
      textQuery: "",
      orientation: null,
      conflictingOrientations: true,
    });
  });
});

describe("resolveOrientationSearch", () => {
  it("keeps the selected direction filter for a normal text query", () => {
    expect(resolveOrientationSearch("제주", "portrait")).toEqual({
      textQuery: "제주",
      effectiveOrientation: "portrait",
      conflictingOrientations: false,
    });
  });

  it("uses the search direction when the direction filter is all", () => {
    expect(resolveOrientationSearch("제주 가로", "all")).toEqual({
      textQuery: "제주",
      effectiveOrientation: "landscape",
      conflictingOrientations: false,
    });
  });

  it("accepts the same direction in the search and selected filter", () => {
    expect(resolveOrientationSearch("제주 세로", "portrait")).toEqual({
      textQuery: "제주",
      effectiveOrientation: "portrait",
      conflictingOrientations: false,
    });
  });

  it("reports a conflict instead of overriding the selected filter", () => {
    expect(resolveOrientationSearch("제주 가로", "portrait")).toEqual({
      textQuery: "제주",
      effectiveOrientation: "portrait",
      conflictingOrientations: true,
    });
  });
});
