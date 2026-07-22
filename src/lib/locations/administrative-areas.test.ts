import { describe, expect, it } from "vitest";
import { normalizeLocationQuery } from "./administrative-areas";

describe("administrative-area suggestions", () => {
  it("removes PostgREST pattern characters from user queries", () => {
    expect(normalizeLocationQuery("  서교%동_(테스트)  ")).toBe("서교동테스트");
  });
});
