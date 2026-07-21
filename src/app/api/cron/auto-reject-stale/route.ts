import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendImageRejected } from "@/lib/email/resend";
import { authorizeCronRequest } from "@/lib/security/cron";

export const maxDuration = 60;

interface StaleImageRow {
  id: string;
  title: string | null;
  asset_id: string | null;
  photographer_id: string | null;
}

async function runRetentionCleanup(admin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await admin.rpc("run_data_retention_cleanup", { dry_run: false });
  if (error) {
    console.error("[auto-reject-stale] retention cleanup failed:", error.message);
    return { ok: false as const };
  }
  return { ok: true as const, result: data };
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
    const retention = await runRetentionCleanup(admin);
    return NextResponse.json({ rejected: 0, retention });
  }

  const reason = "검토 기간(7일)이 초과되어 자동 거절되었습니다. 내용을 수정한 후 재제출해 주세요.";
  let rejected = 0;

  for (const img of staleImages) {
    const { error: updateErr } = await admin
      .from("images")
      .update({ status: "rejected", rejection_reason: reason })
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
  const retention = await runRetentionCleanup(admin);
  return NextResponse.json({ rejected, retention });
}
