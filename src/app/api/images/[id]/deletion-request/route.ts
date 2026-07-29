import { NextRequest, NextResponse } from "next/server";
import { assessImageDeletion, deletionImpactMessage, hasArweaveCredential } from "@/lib/images/deletion";
import { normalizeDeletionFeeConfig, type DeletionFeeSettingRow } from "@/lib/images/deletion-fees";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface RequestImageRow {
  id: string;
  asset_id: string | null;
  title: string;
  status: string | null;
  is_published: boolean | null;
  photographer_id: string | null;
  lifecycle_status: string | null;
  sales_count: number | null;
  proof_status: string | null;
  proof_tx_hash: string | null;
  proof_arweave_original_tx_id: string | null;
  proof_arweave_metadata_tx_id: string | null;
  proof_arweave_manifest_tx_id: string | null;
  proof_arweave_confirmed_at: string | null;
}

function normalizeReasonCategory(value: unknown) {
  const allowed = new Set(["portfolio_cleanup", "copyright_issue", "privacy_issue", "duplicate", "quality", "other"]);
  return typeof value === "string" && allowed.has(value) ? value : "other";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    reason?: unknown;
    reasonCategory?: unknown;
  } | null;

  const reason = typeof body?.reason === "string" && body.reason.trim()
    ? body.reason.trim()
    : "사진가 삭제 요청";
  const reasonCategory = normalizeReasonCategory(body?.reasonCategory);

  const admin = createAdminClient();
  const { data: image, error } = await admin
    .from("images")
    .select(`
      id, asset_id, title, status, is_published, photographer_id, lifecycle_status,
      sales_count, proof_status, proof_tx_hash,
      proof_arweave_original_tx_id, proof_arweave_metadata_tx_id, proof_arweave_manifest_tx_id,
      proof_arweave_confirmed_at
    `)
    .eq("id", id)
    .eq("photographer_id", user.id)
    .single();

  if (error || !image) return NextResponse.json({ error: "Image not found" }, { status: 404 });

  const row = image as RequestImageRow;
  if (row.lifecycle_status && row.lifecycle_status !== "active") {
    return NextResponse.json({ error: "이미 삭제 절차가 진행 중이거나 완료된 이미지입니다." }, { status: 409 });
  }

  if (!hasArweaveCredential(row)) {
    const { data: result, error: archiveError } = await admin.rpc(
      "archive_unregistered_photographer_image",
      {
        target_image_id: id,
        target_user_id: user.id,
        deletion_reason_text: reason,
        reason_category_text: reasonCategory,
      },
    );

    if (archiveError) {
      const status = archiveError.message.includes("already") ? 409 : 500;
      return NextResponse.json({ error: archiveError.message }, { status });
    }

    return NextResponse.json({
      immediate: true,
      result,
      impact: {
        action: "archive",
        lifecycleStatus: "archived",
        buyerNoticeRequired: (row.sales_count ?? 0) > 0,
        onchainNoticeRequired: false,
        storagePurgeAllowed: false,
        reasons: ["photographer_immediate_archive"],
        estimatedFeeKrw: 0,
      },
      notice: "검색과 신규 판매에서 즉시 제외했습니다. 구매이력에는 비활성 상태로 보존되며, 실제 데이터 완전삭제는 관리자가 별도로 처리합니다.",
    });
  }

  const { data: existing } = await admin
    .from("image_deletion_requests")
    .select("id, status, estimated_fee_krw, fee_status")
    .eq("image_id", id)
    .eq("requester_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ request: existing, duplicated: true });
  }

  const { data: feeRows } = await admin
    .from("platform_fee_settings")
    .select("code, amount_krw, active")
    .in("code", ["image_delete_simple", "image_delete_complex"]);

  const impact = assessImageDeletion(row, {
    requesterRole: "photographer",
    feeConfig: normalizeDeletionFeeConfig(feeRows as DeletionFeeSettingRow[] | null),
  });
  const now = new Date().toISOString();
  const { data: request, error: insertError } = await admin
    .from("image_deletion_requests")
    .insert({
      image_id: id,
      requester_id: user.id,
      requester_role: "photographer",
      reason_category: reasonCategory,
      reason,
      requested_action: "auto",
      status: "pending",
      estimated_fee_krw: impact.estimatedFeeKrw,
      charged_fee_krw: impact.estimatedFeeKrw,
      fee_status: impact.estimatedFeeKrw > 0 ? "quoted" : "waived",
      impact_snapshot: { ...impact, wasPublished: row.is_published === true },
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  await admin
    .from("images")
    .update({
      lifecycle_status: "deletion_requested",
      is_published: false,
      unpublished_at: now,
      unpublished_by: user.id,
      unpublished_reason: "사진가 삭제 요청 검토 중",
      deletion_requested_at: now,
      deletion_requested_by: user.id,
      deletion_reason: reason,
      deletion_fee_krw: impact.estimatedFeeKrw,
      deletion_fee_status: impact.estimatedFeeKrw > 0 ? "quoted" : "waived",
      updated_at: now,
    })
    .eq("id", id);

  return NextResponse.json({
    request,
    impact,
    notice: deletionImpactMessage(impact),
  }, { status: 201 });
}
