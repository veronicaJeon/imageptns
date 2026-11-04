import { normalizeRotationDegrees } from "./orientation";
import { transformImageWithCloudflareDetails } from "../cloudflare/image-transform";
import {
  ANALYSIS_DERIVATIVE_JPEG_QUALITY,
  ANALYSIS_DERIVATIVE_MAX_BYTES,
  ANALYSIS_DERIVATIVE_MAX_EDGE,
  ANALYSIS_DERIVATIVE_VERSION,
} from "./analysis-derivative-version";

export {
  ANALYSIS_DERIVATIVE_JPEG_QUALITY,
  ANALYSIS_DERIVATIVE_MAX_BYTES,
  ANALYSIS_DERIVATIVE_MAX_EDGE,
  ANALYSIS_DERIVATIVE_VERSION,
  analysisBackedModelVersion,
} from "./analysis-derivative-version";

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

export async function createAnalysisDerivative(
  input: Buffer,
  rotationDegrees: unknown = 0,
): Promise<AnalysisDerivative> {
  const cloudflareOutput = await transformImageWithCloudflareDetails(input, {
    width: ANALYSIS_DERIVATIVE_MAX_EDGE,
    height: ANALYSIS_DERIVATIVE_MAX_EDGE,
    format: "image/jpeg",
    quality: ANALYSIS_DERIVATIVE_JPEG_QUALITY,
    rotate: normalizeRotationDegrees(rotationDegrees),
  });
  if (cloudflareOutput?.width && cloudflareOutput.height) {
    if (cloudflareOutput.bytes.length > ANALYSIS_DERIVATIVE_MAX_BYTES) {
      throw new Error("Analysis derivative is invalid");
    }
    return {
      bytes: cloudflareOutput.bytes,
      width: cloudflareOutput.width,
      height: cloudflareOutput.height,
      mimeType: "image/jpeg",
      version: ANALYSIS_DERIVATIVE_VERSION,
    };
  }

  const { default: sharp } = await import("sharp");
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
