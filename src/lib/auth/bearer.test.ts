import { describe, expect, it } from "vitest";
import { bearerToken } from "./bearer";

describe("bearerToken", () => {
  it("extracts only a well-formed bearer token", () => {
    expect(bearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
    expect(bearerToken("bearer token-value")).toBe("token-value");
  });

  it("rejects missing and ambiguous authorization values", () => {
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken("Bearer one two")).toBeNull();
  });
});
