import { describe, expect, it } from "vitest";
import { sanitizeOperationalMessage } from "./events";

describe("sanitizeOperationalMessage", () => {
  it("redacts common credential-shaped values", () => {
    expect(sanitizeOperationalMessage("Bearer secret-token failed")).toBe("Bearer [redacted] failed");
    expect(sanitizeOperationalMessage("api_key=top-secret failed")).toBe("api_key=[redacted] failed");
  });

  it("bounds stored messages", () => {
    expect(sanitizeOperationalMessage("x".repeat(700))).toHaveLength(500);
  });
});
