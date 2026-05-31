import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizeCommerceSettings, type CommerceSettingsRow } from "@/lib/commerce/settings";
import {
  computeRegistrationFeeAmount,
  feeOrderName,
  isSelfFundedFeeEligible,
} from "@/lib/onchain/registration-fee";
import { recordOnchainEvent } from "@/lib/onchain/events";

interface FeeImageRow {
  id: string;
  asset_id: string | null;
  title: string;
  status: string;
  sales_count: number | null;
  proof_status: string | null;
  proof_request_payment_status: string | null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = user.id;

  const body = (await req.json().catch(() => null)) as { imageIds?: string[] } | null;
  const imageIds = Array.from(new Set(body?.imageIds ?? [])).filter(Boolean);
  if (imageIds.length === 0) return NextResponse.json({ error: "imageIds required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: rows, error: loadError } = await admin
    .from("images")
    .select("id, asset_id, title, status, sales_count, proof_status, proof_request_payment_status")
    .eq("photographer_id", userId)
    .in("id", imageIds)
    .eq("lifecycle_status", "active");

  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });

  const images = (rows ?? []) as FeeImageRow[];
  const eligible = images.filter((row) =>
    isSelfFundedFeeEligible({
      id: row.id,
      status: row.status,
      salesCount: row.sales_count,
      proofStatus: row.proof_status,
      proofRequestPaymentStatus: row.proof_request_payment_status,
    }),
  );

  if (eligible.length !== imageIds.length) {
    return NextResponse.json(
      {
        error:
          "판매 전 승인 이미지 중 진행 중인 결제가 없는 이미지에 대해서만 셀프등록 수수료를 결제할 수 있습니다.",
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

  const fee = computeRegistrationFeeAmount(settings.arweaveSelfFundedRequestFeeKrw, eligible.length);
  if (fee.amountKrw <= 0) {
    return NextResponse.json(
      { error: "현재 셀프등록 수수료가 0원으로 설정되어 결제가 필요하지 않습니다. 관리자에게 문의해주세요." },
      { status: 400 },
    );
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();

  const tossOrderId = randomUUID();
  const { data: feeOrder, error: orderError } = await admin
    .from("arweave_registration_fee_orders")
    .insert({
      photographer_id: userId,
      toss_order_id: tossOrderId,
      unit_fee_krw: fee.unitFeeKrw,
      image_count: fee.count,
      amount_krw: fee.amountKrw,
      status: "pending",
      billing_name: (profile?.full_name as string | null) ?? null,
      billing_email: user.email ?? null,
    })
    .select("id")
    .single();

  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });
  const feeOrderId = feeOrder.id as string;

  const { error: itemsError } = await admin
    .from("arweave_registration_fee_order_items")
    .insert(
      eligible.map((image) => ({
        fee_order_id: feeOrderId,
        image_id: image.id,
        fee_krw: fee.unitFeeKrw,
      })),
    );
  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });

  const { error: imageUpdateError } = await admin
    .from("images")
    .update({
      proof_request_kind: "self_funded",
      proof_request_fee_payer: "photographer",
      proof_request_fee_krw: fee.unitFeeKrw,
      proof_request_payment_status: "pending",
      proof_request_fee_order_id: feeOrderId,
    })
    .in("id", eligible.map((image) => image.id))
    .eq("photographer_id", userId);

  if (imageUpdateError) return NextResponse.json({ error: imageUpdateError.message }, { status: 500 });

  await Promise.all(
    eligible.map((image) =>
      recordOnchainEvent(admin, {
        eventType: "proof_self_funded_fee_requested",
        actorId: userId,
        imageId: image.id,
        metadata: { feeOrderId, tossOrderId, unitFeeKrw: fee.unitFeeKrw },
      }),
    ),
  );

  return NextResponse.json({
    feeOrderId,
    tossOrderId,
    amount: fee.amountKrw,
    unitFeeKrw: fee.unitFeeKrw,
    imageCount: fee.count,
    orderName: feeOrderName(fee.count),
  });
}
