import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { previewUrl } from "@/lib/supabase/storage";
import {
  canRequestBlockchainRegistration,
  getBlockchainRegistrationState,
} from "@/lib/onchain/registration";
import { recordOnchainEvent } from "@/lib/onchain/events";
import { normalizeCommerceSettings, type CommerceSettingsRow } from "@/lib/commerce/settings";

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
  storage_path_preview: string | null;
  file_size_mb: number | null;
  created_at: string;
}

function normalizeImage(row: RegistrationImageRow, commerceSettings?: ReturnType<typeof normalizeCommerceSettings>) {
  const registrationState = getBlockchainRegistrationState({
    imageStatus: row.status,
    salesCount: row.sales_count,
    proofStatus: row.proof_status,
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = user.id;

  const admin = createAdminClient();
  const [{ data, error }, { data: settingsRow }] = await Promise.all([
    admin
    .from("images")
    .select(`
      id, asset_id, title, category, sales_count, status, proof_status,
      proof_requested_at, proof_registered_at,
      proof_arweave_original_tx_id, proof_arweave_metadata_tx_id,
      proof_arweave_confirmed_at, proof_failure_reason,
      proof_request_fee_payer, proof_request_kind, proof_request_fee_krw,
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = user.id;

  const body = await req.json().catch(() => null) as { imageIds?: string[] } | null;
  const imageIds = Array.from(new Set(body?.imageIds ?? [])).filter(Boolean);
  if (imageIds.length === 0) return NextResponse.json({ error: "imageIds required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: rows, error: loadError } = await admin
    .from("images")
    .select("id, status, sales_count, proof_status")
    .eq("photographer_id", userId)
    .in("id", imageIds)
    .eq("lifecycle_status", "active");

  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });

  const eligibleRows = ((rows ?? []) as Pick<RegistrationImageRow, "id" | "status" | "sales_count" | "proof_status">[])
    .filter((row) =>
      canRequestBlockchainRegistration({
        imageStatus: row.status,
        salesCount: row.sales_count,
        proofStatus: row.proof_status,
      })
    );
  const eligibleIds = eligibleRows.map((row) => row.id);

  if (eligibleIds.length !== imageIds.length) {
    return NextResponse.json(
      { error: "Only approved images with requestable or failed proof status can be requested" },
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
  const selfFundedIds = eligibleRows.filter((row) => (row.sales_count ?? 0) <= 0).map((row) => row.id);
  const postSaleIds = eligibleRows.filter((row) => (row.sales_count ?? 0) > 0).map((row) => row.id);

  async function updateGroup(ids: string[], patch: Record<string, unknown>) {
    if (ids.length === 0) return { error: null };
    return admin
      .from("images")
      .update({
        proof_status: "requested",
        proof_requested_at: requestedAt,
        proof_requested_by: userId,
        proof_failure_reason: null,
        ...patch,
      })
      .in("id", ids)
      .eq("photographer_id", userId);
  }

  const [postSaleUpdate, selfFundedUpdate] = await Promise.all([
    updateGroup(postSaleIds, {
      proof_request_fee_payer: "platform",
      proof_request_kind: "post_sale",
      proof_request_fee_krw: 0,
    }),
    updateGroup(selfFundedIds, {
      proof_request_fee_payer: "photographer",
      proof_request_kind: "self_funded",
      proof_request_fee_krw: settings.arweaveSelfFundedRequestFeeKrw,
    }),
  ]);

  const error = postSaleUpdate.error ?? selfFundedUpdate.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data, error: reloadError } = await admin
    .from("images")
    .select(`
      id, asset_id, title, category, sales_count, status, proof_status,
      proof_requested_at, proof_registered_at,
      proof_arweave_original_tx_id, proof_arweave_metadata_tx_id,
      proof_arweave_confirmed_at, proof_failure_reason,
      proof_request_fee_payer, proof_request_kind, proof_request_fee_krw,
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
          requestKind: selfFundedIds.includes(imageId) ? "self_funded" : "post_sale",
          feePayer: selfFundedIds.includes(imageId) ? "photographer" : "platform",
          feeKrw: selfFundedIds.includes(imageId) ? settings.arweaveSelfFundedRequestFeeKrw : 0,
        },
      }),
    ),
  );

  return NextResponse.json({
    images: ((data ?? []) as RegistrationImageRow[]).map((row) => normalizeImage(row, settings)),
  });
}
