import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendImageRejected } from "@/lib/email/resend";
import {
  attachPhotographerFinalDeleteEligibility,
  purgeHardDeleteImage,
  type HardDeleteImageRow,
} from "@/lib/images/hard-delete-server";
import { authorizeCronRequest } from "@/lib/security/cron";
import { uploadPathBelongsToUser } from "@/lib/uploads/security";
import { dispatchPendingOrderEmails } from "@/lib/orders/email-outbox";
import { analysisDerivativePath } from "@/lib/images/analysis-derivative";

export const maxDuration = 60;

const PHOTOGRAPHER_HIDDEN_IMAGE_AUTO_DELETE_DAYS = 15;
const PHOTOGRAPHER_HIDDEN_IMAGE_AUTO_DELETE_LIMIT = 100;

interface StaleImageRow {
  id: string;
  title: string | null;
  asset_id: string | null;
  photographer_id: string | null;
}

interface PhotographerHiddenImageRow extends HardDeleteImageRow {
  deleted_at: string | null;
  archived_at: string | null;
  unpublished_at: string | null;
}

async function runRetentionCleanup(admin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await admin.rpc("run_data_retention_cleanup", { dry_run: false });
  if (error) {
    console.error("[auto-reject-stale] retention cleanup failed:", error.message);
    return { ok: false as const };
  }
  return { ok: true as const, result: data };
}

async function purgeExpiredUploadSessions(admin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await admin
    .from("upload_sessions")
    .select("id, user_id, storage_path")
    .in("status", ["pending", "processing", "failed"])
    .lt("expires_at", new Date().toISOString())
    .limit(1_000);

  if (error) {
    console.error("[auto-reject-stale] upload session cleanup query failed:", error.message);
    return { ok: false as const };
  }

  const rows = (data ?? []).filter((row) => uploadPathBelongsToUser(row.storage_path, row.user_id));
  const originalPaths = rows.map((row) => row.storage_path);
  const previewPaths = rows.flatMap((row) => [row.storage_path, `thumbs/${row.storage_path}`]);
  const analysisPaths = rows.map((row) => analysisDerivativePath(row.storage_path));

  for (let index = 0; index < originalPaths.length; index += 100) {
    const { error: storageError } = await admin.storage
      .from("images-original")
      .remove(originalPaths.slice(index, index + 100));
    if (storageError) {
      console.error("[auto-reject-stale] expired original cleanup failed:", storageError.message);
      return { ok: false as const };
    }
  }
  for (let index = 0; index < previewPaths.length; index += 100) {
    const { error: storageError } = await admin.storage
      .from("images-preview")
      .remove(previewPaths.slice(index, index + 100));
    if (storageError) {
      console.error("[auto-reject-stale] expired preview cleanup failed:", storageError.message);
      return { ok: false as const };
    }
  }
  for (let index = 0; index < analysisPaths.length; index += 100) {
    const { error: storageError } = await admin.storage
      .from("images-analysis")
      .remove(analysisPaths.slice(index, index + 100));
    if (storageError) {
      console.error("[auto-reject-stale] expired analysis derivative cleanup failed:", storageError.message);
      return { ok: false as const };
    }
  }

  const ids = rows.map((row) => row.id);
  if (ids.length > 0) {
    const { error: updateError } = await admin
      .from("upload_sessions")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .in("id", ids);
    if (updateError) {
      console.error("[auto-reject-stale] upload session cleanup update failed:", updateError.message);
      return { ok: false as const };
    }
  }

  return { ok: true as const, expired: ids.length };
}

function hiddenAtForPhotographerFinalDeletion(image: PhotographerHiddenImageRow) {
  const lifecycle = image.lifecycle_status ?? "active";
  if (lifecycle === "active") return image.unpublished_at;
  return image.deleted_at ?? image.archived_at ?? image.unpublished_at;
}

function isExpiredPhotographerHiddenImage(image: PhotographerHiddenImageRow, cutoffMs: number) {
  if (!image.photographer_id) return false;
  const lifecycle = image.lifecycle_status ?? "active";
  const isHiddenState =
    lifecycle === "archived" ||
    lifecycle === "purged" ||
    (
      lifecycle === "active" &&
      image.status === "approved" &&
      image.is_published === false
    );
  if (!isHiddenState) return false;

  const hiddenAt = hiddenAtForPhotographerFinalDeletion(image);
  if (!hiddenAt) return false;
  const hiddenMs = new Date(hiddenAt).getTime();
  return Number.isFinite(hiddenMs) && hiddenMs <= cutoffMs;
}

async function purgeExpiredPhotographerHiddenImages(admin: ReturnType<typeof createAdminClient>) {
  const cutoffMs = Date.now() - PHOTOGRAPHER_HIDDEN_IMAGE_AUTO_DELETE_DAYS * 24 * 60 * 60 * 1000;
  const { data, error } = await admin
    .from("images")
    .select(`
      id, asset_id, title, status, lifecycle_status, is_published,
      photographer_id, storage_path_preview, storage_path_analysis, storage_path_full, storage_path_original, original_filename,
      file_size_mb, width, height, sales_count, proof_status, proof_tx_hash,
      proof_arweave_original_tx_id, proof_arweave_metadata_tx_id, proof_arweave_manifest_tx_id,
      proof_arweave_confirmed_at, created_at, deleted_at, archived_at, unpublished_at,
      photographer:profiles!photographer_id(full_name)
    `)
    .not("photographer_id", "is", null)
    .or("lifecycle_status.in.(archived,purged),and(status.eq.approved,is_published.eq.false)")
    .limit(PHOTOGRAPHER_HIDDEN_IMAGE_AUTO_DELETE_LIMIT);

  if (error) {
    console.error("[auto-reject-stale] photographer hidden image cleanup query failed:", error.message);
    return { ok: false as const };
  }

  const candidates = ((data ?? []) as PhotographerHiddenImageRow[])
    .filter((image) => isExpiredPhotographerHiddenImage(image, cutoffMs));
  const results = [];

  for (const image of candidates) {
    const assessed = await attachPhotographerFinalDeleteEligibility(admin, image);
    const result = await purgeHardDeleteImage(admin, assessed, {
      deletedBy: null,
      deleteKind: "photographer_request",
      reason: `${PHOTOGRAPHER_HIDDEN_IMAGE_AUTO_DELETE_DAYS}일 자동 삭제`,
    });
    if (!result.purged) {
      console.error("[auto-reject-stale] photographer hidden image cleanup failed:", image.id, result.errors.join(","));
    }
    results.push(result);
  }

  return {
    ok: true as const,
    scanned: data?.length ?? 0,
    eligible: candidates.length,
    purged: results.filter((result) => result.purged).length,
    failed: results.filter((result) => !result.purged).length,
  };
}

async function finishOperationalTasks(admin: ReturnType<typeof createAdminClient>) {
  const [
    retention,
    monitoringRetention,
    rejectedImageRetention,
    rateLimitRetention,
    uploadSessionRetention,
    photographerHiddenImageDeletion,
    imageFingerprintRetention,
    orderEmails,
  ] = await Promise.all([
    runRetentionCleanup(admin),
    admin.rpc("purge_old_operational_events"),
    admin.rpc("archive_expired_rejected_images"),
    admin.rpc("purge_expired_api_rate_limits"),
    purgeExpiredUploadSessions(admin),
    purgeExpiredPhotographerHiddenImages(admin),
    admin.rpc("purge_expired_image_fingerprints"),
    dispatchPendingOrderEmails(10),
  ]);
  if (monitoringRetention.error) {
    console.error("[auto-reject-stale] monitoring retention failed:", monitoringRetention.error.message);
  }
  if (rejectedImageRetention.error) {
    console.error("[auto-reject-stale] rejected image retention failed:", rejectedImageRetention.error.message);
  }
  if (rateLimitRetention.error) {
    console.error("[auto-reject-stale] rate limit retention failed:", rateLimitRetention.error.message);
  }
  if (imageFingerprintRetention.error) {
    console.error("[auto-reject-stale] fingerprint retention failed:", imageFingerprintRetention.error.message);
  }
  return {
    retention,
    monitoringRetention: monitoringRetention.error
      ? { ok: false as const }
      : { ok: true as const, deleted: monitoringRetention.data ?? 0 },
    rejectedImageRetention: rejectedImageRetention.error
      ? { ok: false as const }
      : { ok: true as const, archived: rejectedImageRetention.data ?? 0 },
    rateLimitRetention: rateLimitRetention.error
      ? { ok: false as const }
      : { ok: true as const, deleted: rateLimitRetention.data ?? 0 },
    uploadSessionRetention,
    photographerHiddenImageDeletion,
    imageFingerprintRetention: imageFingerprintRetention.error
      ? { ok: false as const }
      : { ok: true as const, deleted: imageFingerprintRetention.data ?? 0 },
    orderEmails,
  };
}

export async function GET(request: Request) {
  const cronAuthorization = authorizeCronRequest(request.headers);
  if (!cronAuthorization.authorized) {
    return NextResponse.json({ error: cronAuthorization.error }, { status: cronAuthorization.status });
  }

  const admin = createAdminClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Find pending images older than 7 days
  const { data: stale, error } = await admin
    .from("images")
    .select("id, title, asset_id, photographer_id, created_at")
    .eq("status", "pending")
    .lt("created_at", sevenDaysAgo);

  if (error) {
    console.error("[auto-reject-stale] query error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const staleImages = (stale ?? []) as StaleImageRow[];
  if (staleImages.length === 0) {
    const operations = await finishOperationalTasks(admin);
    return NextResponse.json({ rejected: 0, operations });
  }

  const reason = "검토 기간(7일)이 초과되어 자동 반려되었습니다. 내용을 수정한 후 재제출해 주세요.";
  let rejected = 0;

  for (const img of staleImages) {
    const { error: updateErr } = await admin
      .from("images")
      .update({ status: "rejected", rejection_reason: reason, rejected_at: new Date().toISOString() })
      .eq("id", img.id)
      .eq("status", "pending"); // guard against race condition

    if (updateErr) {
      console.error("[auto-reject-stale] update error for", img.id, updateErr.message);
      continue;
    }

    rejected++;

    // Send rejection email (fire-and-forget)
    const photographerId = img.photographer_id;
    if (photographerId) {
      (async () => {
        const [profileRes, authRes] = await Promise.all([
          admin.from("profiles").select("full_name").eq("id", photographerId).single(),
          admin.auth.admin.getUserById(photographerId),
        ]);
        const email = authRes.data.user?.email;
        const name = profileRes.data?.full_name ?? "사진작가";
        if (!email) return;
        await sendImageRejected({
          photographerEmail: email,
          photographerName: name,
          imageTitle: img.title ?? "",
          assetId: img.asset_id ?? "",
          reason,
        });
      })().catch(console.error);
    }
  }

  console.log(`[auto-reject-stale] rejected ${rejected} stale images`);
  const operations = await finishOperationalTasks(admin);
  return NextResponse.json({ rejected, operations });
}
