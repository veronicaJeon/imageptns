import { NextRequest, NextResponse } from "next/server";
import { recordAdminAuditLog } from "@/lib/admin/audit";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { assessProfileWithdrawal, type ProfileWithdrawalImpactInput } from "@/lib/profiles/withdrawal";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface WithdrawalImageRow {
  lifecycle_status: string | null;
  sales_count: number | null;
  onchain_asset_id: string | null;
  proof_status: string | null;
  proof_tx_hash: string | null;
  proof_arweave_original_tx_id: string | null;
  proof_arweave_metadata_tx_id: string | null;
  proof_arweave_manifest_tx_id: string | null;
}

interface ClaimableEarningRow {
  claimable_amount: number | string | null;
}

function hasValue(value: string | null | undefined) {
  return Boolean(value && value.trim());
}

function hasOnchainOrArweaveRecord(image: WithdrawalImageRow) {
  return (
    image.proof_status === "registered" ||
    image.proof_status === "pending" ||
    hasValue(image.onchain_asset_id) ||
    hasValue(image.proof_tx_hash) ||
    hasValue(image.proof_arweave_original_tx_id) ||
    hasValue(image.proof_arweave_metadata_tx_id) ||
    hasValue(image.proof_arweave_manifest_tx_id)
  );
}

async function loadProfileWithdrawalAssessment(
  admin: ReturnType<typeof createAdminClient>,
  profileId: string,
) {
  const [imagesResult, pendingOrdersResult, pendingPayoutsResult, claimableResult] = await Promise.all([
    admin
      .from("images")
      .select(`
        lifecycle_status, sales_count, onchain_asset_id,
        proof_status, proof_tx_hash,
        proof_arweave_original_tx_id, proof_arweave_metadata_tx_id, proof_arweave_manifest_tx_id
      `)
      .eq("photographer_id", profileId),
    admin
      .from("orders")
      .select("id, order_items!inner(id)", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("order_items.photographer_id", profileId),
    admin
      .from("payouts")
      .select("id", { count: "exact", head: true })
      .eq("photographer_id", profileId)
      .in("status", ["pending", "processing"]),
    admin
      .from("earnings_ledger")
      .select("claimable_amount")
      .eq("photographer_id", profileId)
      .eq("claim_status", "claimable"),
  ]);

  const error = imagesResult.error ?? pendingOrdersResult.error ?? pendingPayoutsResult.error ?? claimableResult.error;
  if (error) return { assessment: null, error };

  const images = (imagesResult.data ?? []) as WithdrawalImageRow[];
  const claimableRows = (claimableResult.data ?? []) as ClaimableEarningRow[];
  const impact: ProfileWithdrawalImpactInput = {
    activeImages: images.filter((image) => (image.lifecycle_status ?? "active") === "active").length,
    soldImages: images.filter((image) => Number(image.sales_count ?? 0) > 0).length,
    onchainImages: images.filter(hasOnchainOrArweaveRecord).length,
    pendingOrders: pendingOrdersResult.count ?? 0,
    pendingPayouts: pendingPayoutsResult.count ?? 0,
    claimableEarnings: claimableRows.length,
    claimableAmount: claimableRows.reduce((sum, row) => sum + (Number(row.claimable_amount) || 0), 0),
  };

  return { assessment: assessProfileWithdrawal(impact), error: null };
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const { id } = await params;
  const admin = createAdminClient();
  const [{ data: profile, error: profileError }, authResult, { data: orders, error: ordersError }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, bio, role, avatar_url, wallet_address, phone_number, primary_activity_regions, is_admin, created_at, updated_at, last_login_at, login_count, deleted_at")
      .eq("id", id)
      .single(),
    admin.auth.admin.getUserById(id),
    admin
      .from("orders")
      .select(`
        id, order_number, status, subtotal_krw, vat_krw, total_krw,
        payment_provider, completed_at, created_at,
        order_items(
          id, license_code, price_krw,
          image:images!image_id(id, asset_id, title, storage_path_preview)
        )
      `)
      .eq("buyer_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 404 });
  if (authResult.error) return NextResponse.json({ error: authResult.error.message }, { status: 500 });
  if (ordersError) return NextResponse.json({ error: ordersError.message }, { status: 500 });

  return NextResponse.json({
    user: {
      ...profile,
      email: authResult.data.user?.email ?? "",
      authCreatedAt: authResult.data.user?.created_at ?? null,
      authLastSignInAt: authResult.data.user?.last_sign_in_at ?? null,
    },
    orders: orders ?? [],
  });
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const { id } = await params;
  if (id === adminUser.id) {
    return NextResponse.json({ error: "자기 자신의 관리자 계정은 삭제할 수 없습니다." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: target, error: targetError } = await admin
    .from("profiles")
    .select("id, full_name, is_admin, role")
    .eq("id", id)
    .single();

  if (targetError) return NextResponse.json({ error: targetError.message }, { status: 404 });

  if (target.is_admin) {
    const { count, error: countError } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_admin", true);
    if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: "마지막 관리자 계정은 삭제할 수 없습니다." }, { status: 409 });
    }
  }

  if (target.role === "photographer") {
    const { assessment, error } = await loadProfileWithdrawalAssessment(admin, id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (assessment && !assessment.canDeleteImmediately) {
      const { data: request, error: requestError } = await admin
        .from("profile_withdrawal_requests")
        .insert({
          requester_id: adminUser.id,
          target_profile_id: id,
          requester_role: "admin",
          status: "pending",
          impact_snapshot: assessment,
        })
        .select("id, status, created_at")
        .single();

      if (requestError) return NextResponse.json({ error: requestError.message }, { status: 500 });

      await recordAdminAuditLog(admin, {
        actorId: adminUser.id,
        action: "profile_withdrawal_request.created",
        targetType: "profile_withdrawal_request",
        targetId: request.id,
        targetLabel: target.full_name ?? id,
        before: target,
        after: { request, assessment },
      });

      return NextResponse.json({
        error: "사진작가 계정에 운영 또는 정산 이력이 있어 탈퇴 검토 요청을 생성했습니다.",
        assessment,
        withdrawalRequest: request,
      }, { status: 409 });
    }
  }

  await recordAdminAuditLog(admin, {
    actorId: adminUser.id,
    action: "user.deleted",
    targetType: "user",
    targetId: id,
    targetLabel: target.full_name ?? id,
    before: target,
  });

  const deletedAt = new Date().toISOString();
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      full_name: "탈퇴 회원",
      bio: null,
      avatar_url: null,
      wallet_address: null,
      phone_number: null,
      primary_activity_regions: [],
      is_admin: false,
      deleted_at: deletedAt,
      updated_at: deletedAt,
    })
    .eq("id", id);

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  const { error: authError } = await admin.auth.admin.updateUserById(id, {
    ban_duration: "876000h",
    user_metadata: { deleted_at: deletedAt },
  });
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
