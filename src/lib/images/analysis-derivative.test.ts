import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  ANALYSIS_DERIVATIVE_MAX_EDGE,
  ANALYSIS_DERIVATIVE_VERSION,
  analysisBackedModelVersion,
  analysisDerivativePath,
  createAnalysisDerivative,
} from "./analysis-derivative";

describe("private analysis derivatives", () => {
  it("creates a bounded metadata-free JPEG with normalized orientation", async () => {
    const input = await sharp({
      create: { width: 3_000, height: 2_000, channels: 3, background: "#927451" },
    }).jpeg().withMetadata({ orientation: 6 }).toBuffer();

    const derivative = await createAnalysisDerivative(input);
    const metadata = await sharp(derivative.bytes).metadata();

    expect(derivative.version).toBe(ANALYSIS_DERIVATIVE_VERSION);
    expect(metadata.format).toBe("jpeg");
    expect(Math.max(metadata.width ?? 0, metadata.height ?? 0)).toBe(ANALYSIS_DERIVATIVE_MAX_EDGE);
    expect(metadata.width).toBe(1_067);
    expect(metadata.height).toBe(1_600);
    expect(metadata.orientation).toBeUndefined();
    expect(metadata.exif).toBeUndefined();
  });

  it("uses deterministic private paths and input-versioned embedding rows", () => {
    expect(analysisDerivativePath("owner/photo.tiff")).toBe("owner/photo.tiff.analysis-v1.jpg");
    expect(analysisBackedModelVersion("provider-managed")).toBe("provider-managed+analysis-v1");
    expect(analysisBackedModelVersion("provider-managed+analysis-v1")).toBe("provider-managed+analysis-v1");
  });
});

