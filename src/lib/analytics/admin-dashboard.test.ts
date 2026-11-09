import { describe, expect, it } from "vitest";
import {
  analyticsChange,
  analyticsRate,
  isAdminAnalyticsRange,
} from "./admin-dashboard";

describe("administrator analytics dashboard", () => {
  it("only accepts the supported reporting windows", () => {
    expect(isAdminAnalyticsRange(7)).toBe(true);
    expect(isAdminAnalyticsRange(30)).toBe(true);
    expect(isAdminAnalyticsRange(90)).toBe(true);
    expect(isAdminAnalyticsRange(31)).toBe(false);
  });

  it("calculates previous-period changes without inventing an infinite percentage", () => {
    expect(analyticsChange(120, 100)).toBe(20);
    expect(analyticsChange(80, 100)).toBe(-20);
    expect(analyticsChange(0, 0)).toBe(0);
    expect(analyticsChange(1, 0)).toBeNull();
  });

  it("keeps funnel rates in a display-safe range", () => {
    expect(analyticsRate(3, 12)).toBe(25);
    expect(analyticsRate(4, 0)).toBe(0);
    expect(analyticsRate(20, 10)).toBe(100);
  });
});
