import "server-only";
import { createHash } from "node:crypto";
import type { createAdminClient } from "@/lib/supabase/admin";
import { storageBinaryBody } from "@/lib/supabase/storage-body";
import {
  ANALYSIS_DERIVATIVE_MAX_BYTES,
  ANALYSIS_DERIVATIVE_VERSION,
  AnalysisDerivativeError,
  analysisDerivativePath,
  createAnalysisDerivative,
  type AnalysisDerivative,
} from "./analysis-derivative";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface AnalysisDerivativeImage {
  id: string;
  storage_path_original: string | null;
  storage_path_analysis: string | null;
  analysis_derivative_version: string | null;
  upload_rotation_degrees: number | null;
}

export interface StoredAnalysisDerivative extends AnalysisDerivative {
  path: string;
  sourceSha256: string;
}

async function downloadStoredDerivative(admin: AdminClient, path: string): Promise<StoredAnalysisDerivative> {
  const { data, error } = await admin.storage.from("images-analysis").download(path);
  if (error || !data || data.size < 1 || data.size > ANALYSIS_DERIVATIVE_MAX_BYTES) {
    throw new AnalysisDerivativeError("ANALYSIS_DERIVATIVE_DOWNLOAD_FAILED", true);
  }
  const bytes = Buffer.from(await data.arrayBuffer());
  return {
    bytes,
    width: 0,
    height: 0,
    mimeType: "image/jpeg",
    version: ANALYSIS_DERIVATIVE_VERSION,
    path,
    sourceSha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

export async function ensureAnalysisDerivative(
  admin: AdminClient,
  image: AnalysisDerivativeImage,
): Promise<StoredAnalysisDerivative> {
  if (
    image.storage_path_analysis
    && image.analysis_derivative_version === ANALYSIS_DERIVATIVE_VERSION
  ) {
    return downloadStoredDerivative(admin, image.storage_path_analysis);
  }
  if (!image.storage_path_original) {
    throw new AnalysisDerivativeError("ANALYSIS_SOURCE_MISSING", false);
  }

  const { data: original, error: downloadError } = await admin.storage
    .from("images-original")
    .download(image.storage_path_original);
  if (downloadError || !original || original.size < 1) {
    throw new AnalysisDerivativeError("ANALYSIS_SOURCE_DOWNLOAD_FAILED", true);
  }

  let derivative;
  try {
    derivative = await createAnalysisDerivative(
      Buffer.from(await original.arrayBuffer()),
      image.upload_rotation_degrees,
    );
  } catch {
    throw new AnalysisDerivativeError("ANALYSIS_DERIVATIVE_INVALID", false);
  }
  const path = analysisDerivativePath(image.storage_path_original);
  const { error: uploadError } = await admin.storage
    .from("images-analysis")
    .upload(path, storageBinaryBody(derivative.bytes), {
      contentType: derivative.mimeType,
      upsert: true,
    });
  if (uploadError) throw new AnalysisDerivativeError("ANALYSIS_DERIVATIVE_UPLOAD_FAILED", true);

  const { error: updateError } = await admin.from("images").update({
    storage_path_analysis: path,
    analysis_derivative_version: derivative.version,
  }).eq("id", image.id);
  if (updateError) throw new AnalysisDerivativeError("ANALYSIS_DERIVATIVE_METADATA_FAILED", true);

  return {
    ...derivative,
    path,
    sourceSha256: createHash("sha256").update(derivative.bytes).digest("hex"),
  };
}
