import { NextResponse } from "next/server";
import { assessProfileWithdrawal, type ProfileWithdrawalImpactInput } from "@/lib/profiles/withdrawal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
      .select("id", { count: "exact", head: true })
      .eq("buyer_id", profileId)
      .in("status", ["pending", "payment_requested", "processing"]),
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

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, role, deleted_at")
    .eq("id", user.id)
    .single();

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 404 });
  if (profile.deleted_at) {
    return NextResponse.json({ error: "이미 탈퇴 처리된 계정입니다." }, { status: 409 });
  }

  const { data: existing, error: existingError } = await admin
    .from("profile_withdrawal_requests")
    .select("id, status, created_at")
    .eq("target_profile_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  if (existing) return NextResponse.json({ request: existing, alreadyExists: true });

  const { assessment, error } = await loadProfileWithdrawalAssessment(admin, user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: request, error: requestError } = await admin
    .from("profile_withdrawal_requests")
    .insert({
      requester_id: user.id,
      target_profile_id: user.id,
      requester_role: "user",
      status: "pending",
      impact_snapshot: assessment,
    })
    .select("id, status, created_at")
    .single();

  if (requestError) return NextResponse.json({ error: requestError.message }, { status: 500 });

  return NextResponse.json({ request, assessment });
}
