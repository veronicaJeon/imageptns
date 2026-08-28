export const ANALYSIS_DERIVATIVE_VERSION = "analysis-v1";
export const ANALYSIS_DERIVATIVE_MAX_EDGE = 1_600;
export const ANALYSIS_DERIVATIVE_JPEG_QUALITY = 82;
export const ANALYSIS_DERIVATIVE_MAX_BYTES = 10 * 1024 * 1024;

export function analysisBackedModelVersion(providerModelVersion: string) {
  const normalized = providerModelVersion.trim();
  const suffix = `+${ANALYSIS_DERIVATIVE_VERSION}`;
  return normalized.endsWith(suffix) ? normalized : `${normalized}${suffix}`;
}
