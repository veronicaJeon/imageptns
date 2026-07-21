import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { previewUrl } from "@/lib/supabase/storage";
import {
  canRequestFreeRegistration,
  getBlockchainRegistrationState,
} from "@/lib/onchain/registration";
import { recordOnchainEvent } from "@/lib/onchain/events";
import { normalizeCommerceSettings, type CommerceSettingsRow } from "@/lib/commerce/settings";
import { requireApprovedPhotographer } from "@/lib/photographers/approval";
import { isOnchainEnabled } from "@/lib/onchain/env";

interface RegistrationImageRow {
  id: string;
  asset_id: string | null;
  title: string;
  category: string | null;
  sales_count: number | null;
  status: string;
  proof_status: string | null;
  proof_requested_at: string | null;
  proof_registered_at: string | null;
  proof_arweave_original_tx_id: string | null;
  proof_arweave_metadata_tx_id: string | null;
  proof_arweave_confirmed_at: string | null;
  proof_failure_reason: string | null;
  proof_request_fee_payer: string | null;
  proof_request_kind: string | null;
  proof_request_fee_krw: number | null;
  proof_request_payment_status: string | null;
  proof_request_fee_order_id: string | null;
  storage_path_preview: string | null;
  file_size_mb: number | null;
  created_at: string;
}

function normalizeImage(row: RegistrationImageRow, commerceSettings?: ReturnType<typeof normalizeCommerceSettings>) {
  const registrationState = getBlockchainRegistrationState({
    imageStatus: row.status,
    salesCount: row.sales_count,
    proofStatus: row.proof_status,
    proofRequestKind: row.proof_request_kind,
    proofRequestPaymentStatus: row.proof_request_payment_status,
  });

  return {
    ...row,
    proof_request_fee_krw:
      registrationState === "self_funded_available"
        ? commerceSettings?.arweaveSelfFundedRequestFeeKrw ?? row.proof_request_fee_krw
        : row.proof_request_fee_krw,
    storage_path_preview: previewUrl(row.storage_path_preview),
    registration_state: registrationState,
  };
}

export async function GET() {
  if (!isOnchainEnabled()) {
    return NextResponse.json({ error: "Onchain features are disabled" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = user.id;

  const admin = createAdminClient();
  const authorization = await requireApprovedPhotographer(admin, userId);
  if (!authorization.ok) return authorization.response;

  const [{ data, error }, { data: settingsRow }] = await Promise.all([
    admin
    .from("images")
    .select(`
      id, asset_id, title, category, sales_count, status, proof_status,
      proof_requested_at, proof_registered_at,
      proof_arweave_original_tx_id, proof_arweave_metadata_tx_id,
      proof_arweave_confirmed_at, proof_failure_reason,
      proof_request_fee_payer, proof_request_kind, proof_request_fee_krw,
      proof_request_payment_status, proof_request_fee_order_id,
      storage_path_preview, file_size_mb, created_at
    `)
    .eq("photographer_id", userId)
    .eq("status", "approved")
    .eq("lifecycle_status", "active")
    .order("created_at", { ascending: false }),
    admin
      .from("platform_commerce_settings")
      .select("download_access_days, subscription_basic_downloads, subscription_pro_downloads, subscription_enterprise_downloads, arweave_self_funded_request_fee_krw")
      .eq("id", true)
      .maybeSingle(),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const settings = normalizeCommerceSettings(settingsRow as CommerceSettingsRow | null);

  return NextResponse.json({
    images: ((data ?? []) as RegistrationImageRow[]).map((row) => normalizeImage(row, settings)),
  });
}

export async function POST(req: NextRequest) {
  if (!isOnchainEnabled()) {
    return NextResponse.json({ error: "Onchain features are disabled" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = user.id;

  const body = await req.json().catch(() => null) as { imageIds?: string[] } | null;
  const imageIds = Array.from(new Set(body?.imageIds ?? [])).filter(Boolean);
  if (imageIds.length === 0) return NextResponse.json({ error: "imageIds required" }, { status: 400 });

  const admin = createAdminClient();
  const authorization = await requireApprovedPhotographer(admin, userId);
  if (!authorization.ok) return authorization.response;

  const { data: rows, error: loadError } = await admin
    .from("images")
    .select("id, status, sales_count, proof_status")
    .eq("photographer_id", userId)
    .in("id", imageIds)
    .eq("lifecycle_status", "active");

  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });

  // Free path covers only platform-funded (post-sale) and failed-retry requests.
  // Pre-sale (self-funded) images must pay the fee via /api/onchain/registration-fee.
  const eligibleRows = ((rows ?? []) as Pick<RegistrationImageRow, "id" | "status" | "sales_count" | "proof_status">[])
    .filter((row) =>
      (row.sales_count ?? 0) > 0 &&
      canRequestFreeRegistration({
        imageStatus: row.status,
        salesCount: row.sales_count,
        proofStatus: row.proof_status,
      })
    );
  const eligibleIds = eligibleRows.map((row) => row.id);

  if (eligibleIds.length !== imageIds.length) {
    return NextResponse.json(
      {
        error:
          "판매 완료 이미지만 무료 등록 요청할 수 있습니다. 판매 전 이미지는 셀프등록 수수료 결제 후 요청됩니다.",
        code: "SELF_FUNDED_FEE_REQUIRED",
      },
      { status: 409 },
    );
  }

  const { data: settingsRow } = await admin
    .from("platform_commerce_settings")
    .select("download_access_days, subscription_basic_downloads, subscription_pro_downloads, subscription_enterprise_downloads, arweave_self_funded_request_fee_krw")
    .eq("id", true)
    .maybeSingle();
  const settings = normalizeCommerceSettings(settingsRow as CommerceSettingsRow | null);
  const requestedAt = new Date().toISOString();

  const { error: updateError } = await admin
    .from("images")
    .update({
      proof_status: "requested",
      proof_requested_at: requestedAt,
      proof_requested_by: userId,
      proof_failure_reason: null,
      proof_request_fee_payer: "platform",
      proof_request_kind: "post_sale",
      proof_request_fee_krw: 0,
      proof_request_payment_status: "none",
    })
    .in("id", eligibleIds)
    .eq("photographer_id", userId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const { data, error: reloadError } = await admin
    .from("images")
    .select(`
      id, asset_id, title, category, sales_count, status, proof_status,
      proof_requested_at, proof_registered_at,
      proof_arweave_original_tx_id, proof_arweave_metadata_tx_id,
      proof_arweave_confirmed_at, proof_failure_reason,
      proof_request_fee_payer, proof_request_kind, proof_request_fee_krw,
      proof_request_payment_status, proof_request_fee_order_id,
      storage_path_preview, file_size_mb, created_at
    `)
    .in("id", eligibleIds)
    .eq("photographer_id", userId);

  if (reloadError) return NextResponse.json({ error: reloadError.message }, { status: 500 });

  await Promise.all(
    eligibleIds.map((imageId) =>
      recordOnchainEvent(admin, {
        eventType: "proof_registration_requested",
        actorId: userId,
        imageId,
        metadata: {
          requestedAt,
          requestKind: "post_sale",
          feePayer: "platform",
          feeKrw: 0,
        },
      }),
    ),
  );

  return NextResponse.json({
    images: ((data ?? []) as RegistrationImageRow[]).map((row) => normalizeImage(row, settings)),
  });
}
