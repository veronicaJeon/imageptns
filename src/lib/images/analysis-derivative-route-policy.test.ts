import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const uploadRoute = readFileSync("src/app/api/uploads/route.ts", "utf8");
const semanticRepository = readFileSync("src/lib/images/semantic-indexing-repository.ts", "utf8");
const captionWorker = readFileSync("src/lib/images/nvidia-caption-worker.ts", "utf8");
const hardDelete = readFileSync("src/lib/images/hard-delete-server.ts", "utf8");

describe("private analysis derivative route policy", () => {
  it("creates the clean derivative before deriving public watermarked previews", () => {
    expect(uploadRoute.indexOf("createAnalysisDerivative(buffer")).toBeGreaterThan(-1);
    expect(uploadRoute.indexOf("createAnalysisDerivative(buffer")).toBeLessThan(
      uploadRoute.indexOf("const watermarked = await applyWatermarkToAnalysisDerivative"),
    );
    expect(uploadRoute).toContain('.from("images-analysis")');
    expect(uploadRoute).toContain("storage_path_analysis: analysisPath");
    expect(uploadRoute).toContain("storage_path_analysis: undefined");
  });

  it("uses the private derivative for embeddings and captions", () => {
    expect(semanticRepository).toContain("ensureAnalysisDerivative(admin, image)");
    expect(semanticRepository).not.toContain('.from("images-preview").download');
    expect(captionWorker).toContain("ensureAnalysisDerivative(admin");
    expect(captionWorker).not.toContain('.from("images-preview").download');
  });

  it("removes clean derivatives during hard deletion", () => {
    expect(hardDelete).toContain("analysis: uniqueStrings([image.storage_path_analysis])");
    expect(hardDelete).toContain('.from("images-analysis").remove(paths.analysis)');
  });
});
