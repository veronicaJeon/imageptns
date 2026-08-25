import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/074_private_analysis_derivatives.sql", "utf8");

describe("private analysis derivative migration", () => {
  it("creates a private JPEG-only bucket without public read policies", () => {
    expect(migration).toContain("'images-analysis', 'images-analysis', false");
    expect(migration).toContain("array['image/jpeg']");
    expect(migration).not.toMatch(/create\s+policy[\s\S]+images-analysis/i);
  });

  it("pairs the private path with a versioned pipeline", () => {
    expect(migration).toContain("storage_path_analysis");
    expect(migration).toContain("analysis_derivative_version");
    expect(migration).toContain("images_analysis_derivative_pair_check");
  });
});

