import sharp from "sharp";
import { normalizeRotationDegrees } from "./orientation";

export const ANALYSIS_DERIVATIVE_VERSION = "analysis-v1";
export const ANALYSIS_DERIVATIVE_MAX_EDGE = 1_600;
export const ANALYSIS_DERIVATIVE_JPEG_QUALITY = 82;
export const ANALYSIS_DERIVATIVE_MAX_BYTES = 10 * 1024 * 1024;

export class AnalysisDerivativeError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super("Analysis derivative processing failed");
    this.name = "AnalysisDerivativeError";
  }
}

export interface AnalysisDerivative {
  bytes: Buffer;
  width: number;
  height: number;
  mimeType: "image/jpeg";
  version: typeof ANALYSIS_DERIVATIVE_VERSION;
}

export function analysisDerivativePath(originalPath: string) {
  return `${originalPath}.${ANALYSIS_DERIVATIVE_VERSION}.jpg`;
}

export function analysisBackedModelVersion(providerModelVersion: string) {
  const normalized = providerModelVersion.trim();
  const suffix = `+${ANALYSIS_DERIVATIVE_VERSION}`;
  return normalized.endsWith(suffix) ? normalized : `${normalized}${suffix}`;
}

export async function createAnalysisDerivative(
  input: Buffer,
  rotationDegrees: unknown = 0,
): Promise<AnalysisDerivative> {
  const output = await sharp(input)
    .rotate()
    .rotate(normalizeRotationDegrees(rotationDegrees))
    .resize({
      width: ANALYSIS_DERIVATIVE_MAX_EDGE,
      height: ANALYSIS_DERIVATIVE_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: ANALYSIS_DERIVATIVE_JPEG_QUALITY, chromaSubsampling: "4:2:0" })
    .toBuffer({ resolveWithObject: true });

  if (!output.info.width || !output.info.height || output.data.length > ANALYSIS_DERIVATIVE_MAX_BYTES) {
    throw new Error("Analysis derivative is invalid");
  }

  return {
    bytes: output.data,
    width: output.info.width,
    height: output.info.height,
    mimeType: "image/jpeg",
    version: ANALYSIS_DERIVATIVE_VERSION,
  };
}
