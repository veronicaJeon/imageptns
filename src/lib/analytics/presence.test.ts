import { describe, expect, it } from "vitest";
import { ACTIVE_PRESENCE_WINDOW_MS, activePresenceSince, isActivePresence } from "./presence";

describe("presence helpers", () => {
  const now = new Date("2026-05-20T00:00:00.000Z");

  it("uses a two minute active window", () => {
    expect(ACTIVE_PRESENCE_WINDOW_MS).toBe(120_000);
    expect(activePresenceSince(now).toISOString()).toBe("2026-05-19T23:58:00.000Z");
  });

  it("treats recent pings as active", () => {
    expect(isActivePresence("2026-05-19T23:59:00.000Z", now)).toBe(true);
    expect(isActivePresence("2026-05-19T23:57:59.999Z", now)).toBe(false);
  });
});
