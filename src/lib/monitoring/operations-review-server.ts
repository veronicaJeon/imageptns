import "server-only";
import { getSemanticImageSearchConfig } from "@/lib/images/semantic-embedding";
import { previewUrl } from "@/lib/supabase/storage";
import { hasJpegSignature } from "@/lib/supabase/storage-body";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordOperationalEvent } from "./events";
import { evaluateOperationsReview, type OperationsReviewMetrics } from "./operations-review";

async function validatePreview(path: string) {
  try {
    const response = await fetch(previewUrl(`thumbs/${path}`), {
      cache: "no-store",
      headers: { Range: "bytes=0-15" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return false;
    return hasJpegSignature(new Uint8Array(await response.arrayBuffer()));
  } catch {
    return false;
  }
}

async function countInvalidPreviews(paths: string[]) {
  let invalid = 0;
  for (let index = 0; index < paths.length; index += 8) {
    const results = await Promise.all(paths.slice(index, index + 8).map(validatePreview));
    invalid += results.filter((valid) => !valid).length;
  }
  return invalid;
}

function exactCount(result: { count: number | null; error: { message: string } | null }, label: string) {
  if (result.error) throw new Error(`${label} lookup failed`);
  return result.count ?? 0;
}

export async function runOperationsReview() {
  const startedAt = Date.now();
  const admin = createAdminClient();
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  let semanticConfig;
  try {
    semanticConfig = getSemanticImageSearchConfig();
  } catch {
    semanticConfig = { enabled: false, indexingEnabled: false };
  }

  const [
    publicImages,
    missingPreview,
    missingAnalysis,
    imageReview,
    photographerApplications,
    generalInquiries,
    photoRequests,
    bankTransfers,
    failedOrderEmails,
    requestErrors,
    newUsers,
    uploads,
    completedOrders,
    downloads,
    previousNewUsers,
    previousUploads,
    previousCompletedOrders,
    previousDownloads,
  ] = await Promise.all([
    admin.from("images").select("id, storage_path_preview", { count: "exact" })
      .eq("status", "approved").eq("lifecycle_status", "active").eq("is_published", true),
    admin.from("images").select("id", { count: "exact", head: true })
      .eq("status", "approved").eq("lifecycle_status", "active").eq("is_published", true)
      .is("storage_path_preview", null),
    admin.from("images").select("id", { count: "exact", head: true })
      .eq("status", "approved").eq("lifecycle_status", "active").eq("is_published", true)
      .is("storage_path_analysis", null),
    admin.from("images").select("id", { count: "exact", head: true }).eq("status", "pending").lt("created_at", cutoff24h),
    admin.from("photographer_applications").select("id", { count: "exact", head: true }).eq("status", "pending").lt("created_at", cutoff48h),
    admin.from("contact_submissions").select("id", { count: "exact", head: true })
      .eq("inquiry_type", "general").eq("status", "pending").lt("created_at", cutoff24h),
    admin.from("contact_submissions").select("id", { count: "exact", head: true })
      .eq("inquiry_type", "photo_request").eq("request_status", "submitted").lt("created_at", cutoff24h),
    admin.from("orders").select("id", { count: "exact", head: true })
      .eq("payment_provider", "bank_transfer").eq("offline_payment_status", "requested").lt("offline_payment_requested_at", cutoff24h),
    admin.from("order_email_outbox").select("id", { count: "exact", head: true }).eq("status", "failed"),
    admin.from("operational_events").select("id", { count: "exact", head: true })
      .eq("event_type", "request_error").gte("created_at", cutoff24h),
    admin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", cutoff24h),
    admin.from("images").select("id", { count: "exact", head: true }).gte("created_at", cutoff24h),
    admin.from("orders").select("id", { count: "exact", head: true }).eq("status", "completed").gte("completed_at", cutoff24h),
    admin.from("downloads").select("id", { count: "exact", head: true }).gte("created_at", cutoff24h),
    admin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", cutoff48h).lt("created_at", cutoff24h),
    admin.from("images").select("id", { count: "exact", head: true }).gte("created_at", cutoff48h).lt("created_at", cutoff24h),
    admin.from("orders").select("id", { count: "exact", head: true }).eq("status", "completed").gte("completed_at", cutoff48h).lt("completed_at", cutoff24h),
    admin.from("downloads").select("id", { count: "exact", head: true }).gte("created_at", cutoff48h).lt("created_at", cutoff24h),
  ]);

  if (publicImages.error) throw new Error("Public image inventory lookup failed");
  const previewPaths = (publicImages.data ?? [])
    .map((image) => image.storage_path_preview)
    .filter((path): path is string => Boolean(path));
  const eligibleImageIds = new Set((publicImages.data ?? []).map((image) => image.id));
  const invalidPreview = await countInvalidPreviews(previewPaths);

  let semantic = { enabled: false, ready: 0, pending: 0, failed: 0, missing: 0 };
  if (semanticConfig.enabled && semanticConfig.modelVersion) {
    const { data, error } = await admin.from("image_semantic_embeddings")
      .select("image_id, status")
      .eq("provider", semanticConfig.provider!)
      .eq("model", semanticConfig.model!)
      .eq("model_version", semanticConfig.modelVersion);
    if (error) throw new Error("Semantic inventory lookup failed");
    const rows = (data ?? []).filter((row) => eligibleImageIds.has(row.image_id));
    const ready = rows.filter((row) => row.status === "ready").length;
    const failed = rows.filter((row) => row.status === "failed").length;
    const pending = rows.filter((row) => ["pending", "processing", "stale"].includes(row.status)).length;
    semantic = {
      enabled: true,
      ready,
      pending,
      failed,
      missing: Math.max(0, (publicImages.count ?? previewPaths.length) - rows.length),
    };
  }

  const metrics: OperationsReviewMetrics = {
    inventory: {
      publicImages: publicImages.count ?? previewPaths.length,
      missingPreview: exactCount(missingPreview, "Missing preview"),
      invalidPreview,
      missingAnalysis: exactCount(missingAnalysis, "Missing analysis derivative"),
    },
    workflow: {
      imageReviewOver24h: exactCount(imageReview, "Image review SLA"),
      photographerApplicationOver48h: exactCount(photographerApplications, "Photographer application SLA"),
      generalInquiryOver24h: exactCount(generalInquiries, "General inquiry SLA"),
      photoRequestOver24h: exactCount(photoRequests, "Photo request SLA"),
      bankTransferOver24h: exactCount(bankTransfers, "Bank transfer SLA"),
    },
    semantic,
    delivery: { failedOrderEmails: exactCount(failedOrderEmails, "Order email failure") },
    reliability: { requestErrors24h: exactCount(requestErrors, "Request error") },
    activity24h: {
      newUsers: exactCount(newUsers, "New user activity"),
      uploads: exactCount(uploads, "Upload activity"),
      completedOrders: exactCount(completedOrders, "Completed order activity"),
      downloads: exactCount(downloads, "Download activity"),
    },
    activityPrevious24h: {
      newUsers: exactCount(previousNewUsers, "Previous new user activity"),
      uploads: exactCount(previousUploads, "Previous upload activity"),
      completedOrders: exactCount(previousCompletedOrders, "Previous completed order activity"),
      downloads: exactCount(previousDownloads, "Previous download activity"),
    },
  };
  const result = evaluateOperationsReview(metrics);
  await recordOperationalEvent({
    eventType: "operations_daily_review",
    component: "operations",
    status: result.status,
    route: "/api/cron/operations-review",
    statusCode: result.status === "error" ? 503 : 200,
    durationMs: Date.now() - startedAt,
    errorCode: result.findings[0]?.code,
    message: result.findings.map((finding) => `${finding.code}:${finding.count}`).join(", ") || undefined,
    metadata: {
      findingCount: result.findings.length,
      publicImages: metrics.inventory.publicImages,
      readyEmbeddings: metrics.semantic.ready,
      activityEvents: Object.values(metrics.activity24h).reduce((sum, value) => sum + value, 0),
      previousActivityEvents: Object.values(metrics.activityPrevious24h).reduce((sum, value) => sum + value, 0),
    },
  });
  return { ...result, durationMs: Date.now() - startedAt, checkedAt: new Date().toISOString() };
}
