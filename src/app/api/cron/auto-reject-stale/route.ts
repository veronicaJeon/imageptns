import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendImageRejected } from "@/lib/email/resend";

export const maxDuration = 60;

export async function GET() {
  // Security: Vercel sends this header on cron calls (check in production)
  // For simplicity in MVP, this route relies on being non-public knowledge.
  // TODO: add CRON_SECRET header verification for production.

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

  if (!stale || stale.length === 0) {
    return NextResponse.json({ rejected: 0 });
  }

  const reason = "검토 기간(7일)이 초과되어 자동 거절되었습니다. 내용을 수정한 후 재제출해 주세요.";
  let rejected = 0;

  for (const img of stale) {
    const { error: updateErr } = await admin
      .from("images")
      .update({ status: "rejected", rejection_reason: reason })
      .eq("id", (img as any).id)
      .eq("status", "pending"); // guard against race condition

    if (updateErr) {
      console.error("[auto-reject-stale] update error for", (img as any).id, updateErr.message);
      continue;
    }

    rejected++;

    // Send rejection email (fire-and-forget)
    if ((img as any).photographer_id) {
      (async () => {
        const [profileRes, authRes] = await Promise.all([
          admin.from("profiles").select("full_name").eq("id", (img as any).photographer_id).single(),
          admin.auth.admin.getUserById((img as any).photographer_id),
        ]);
        const email = authRes.data.user?.email;
        const name = profileRes.data?.full_name ?? "사진작가";
        if (!email) return;
        await sendImageRejected({
          photographerEmail: email,
          photographerName: name,
          imageTitle: (img as any).title,
          assetId: (img as any).asset_id ?? "",
          reason,
        });
      })().catch(console.error);
    }
  }

  console.log(`[auto-reject-stale] rejected ${rejected} stale images`);
  return NextResponse.json({ rejected });
}
