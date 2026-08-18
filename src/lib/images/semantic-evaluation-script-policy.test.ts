import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("semantic evaluation runner policy", () => {
  const runner = source("scripts/semantic-evaluation-smoke.mjs");
  const gitignore = source(".gitignore");

  it("keeps local images and API run artifacts out of Git", () => {
    expect(gitignore).toContain(".semantic-evaluation/");
    expect(runner).toContain('join(root, ".semantic-evaluation")');
    expect(runner).toContain('{ mode: 0o600 }');
  });

  it("reads provider keys from server-side environment without logging them", () => {
    expect(runner).toContain("process.env.NVIDIA_API_KEY");
    expect(runner).toContain("process.env.VOYAGE_API_KEY");
    expect(runner).not.toMatch(/console\.log\([^\n]*(apiKey|credentials)/);
  });

  it("preserves provider capability and trial rate-limit boundaries", () => {
    expect(runner).toContain('imageToImage: { status: "unsupported" }');
    expect(runner).toContain("VOYAGE_MIN_INTERVAL_MS || 21_000");
    expect(runner).toContain('process.argv.includes("--skip-generative")');
  });
});
