import { describe, expect, it } from "vitest";
import { normalizeRotationDegrees, rotatedDimensions } from "./orientation";

describe("image orientation helpers", () => {
  it("normalizes arbitrary rotation values to clockwise quarter turns", () => {
    expect(normalizeRotationDegrees(90)).toBe(90);
    expect(normalizeRotationDegrees(-90)).toBe(270);
    expect(normalizeRotationDegrees(450)).toBe(90);
    expect(normalizeRotationDegrees(42)).toBe(0);
  });

  it("swaps dimensions for quarter-turn rotations", () => {
    expect(rotatedDimensions(1200, 1800, 0)).toEqual({ width: 1200, height: 1800 });
    expect(rotatedDimensions(1200, 1800, 90)).toEqual({ width: 1800, height: 1200 });
    expect(rotatedDimensions(1200, 1800, 270)).toEqual({ width: 1800, height: 1200 });
  });
});
