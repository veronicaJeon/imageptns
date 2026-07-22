import { describe, expect, it } from "vitest";
import {
  dateValueInTimeZone,
  localTodayDateValue,
  takenAtDatePart,
  takenAtIsAllowed,
  takenAtIsFuture,
} from "./taken-at";

describe("taken-at date validation", () => {
  it("accepts past, current, and unknown dates", () => {
    expect(takenAtIsAllowed("2026-07-21", "2026-07-22")).toBe(true);
    expect(takenAtIsAllowed("2026-07-22", "2026-07-22")).toBe(true);
    expect(takenAtIsAllowed("unknown", "2026-07-22")).toBe(true);
  });

  it("rejects future and malformed dates", () => {
    expect(takenAtIsAllowed("2026-07-23", "2026-07-22")).toBe(false);
    expect(takenAtIsAllowed("July 23", "2026-07-22")).toBe(false);
    expect(takenAtIsAllowed("2026-02-31", "2026-07-22")).toBe(false);
    expect(takenAtIsFuture("2026-07-23T01:00:00Z", "2026-07-22")).toBe(true);
  });

  it("extracts the date portion from timestamps", () => {
    expect(takenAtDatePart("2026-07-22T13:00:00.000Z")).toBe("2026-07-22");
  });

  it("formats dates for the browser and the operating timezone", () => {
    const instant = new Date("2026-07-21T16:30:00.000Z");
    expect(dateValueInTimeZone(instant, "Asia/Seoul")).toBe("2026-07-22");
    expect(localTodayDateValue(new Date(2026, 6, 22, 12))).toBe("2026-07-22");
  });
});
