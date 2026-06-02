import { NextRequest, NextResponse } from "next/server";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canCancelFeeOrder, canRefundFeeOrder } from "@/lib/onchain/registration-fee";
import { recordOnchainEvent } from "@/lib/onchain/events";

interface FeeOrderRow {
  id: string;
  photographer_id: string;
  toss_order_id: string;
  toss_payment_key: string | null;
  unit_fee_krw: number;
  image_count: number;
  amount_krw: number;
  status: string;
  billing_name: string | null;
  billing_email: string | null;
  created_at: string;
  paid_at: string | null;
  canceled_at: string | null;
  refunded_at: string | null;
  cancel_reason: string | null;
  photographer: { full_name: string | null } | { full_name: string | null }[] | null;
  items: { image_id: string; fee_krw: number; images: { title: string | null; asset_id: string | null } | { title: string | null; asset_id: string | null }[] | null }[] | null;
}

function normalize(row: FeeOrderRow) {
  const photographer = Array.isArray(row.photographer) ? row.photographer[0] : row.photographer;
  return {
    id: row.id,
    photographerId: row.photographer_id,
    photographerName: photographer?.full_name ?? null,
    tossOrderId: row.toss_order_id,
    paymentKey: row.toss_payment_key,
    unitFeeKrw: row.unit_fee_krw,
    imageCount: row.image_count,
    amountKrw: row.amount_krw,
    status: row.status,
    billingName: row.billing_name,
    billingEmail: row.billing_email,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    canceledAt: row.canceled_at,
    refundedAt: row.refunded_at,
    cancelReason: row.cancel_reason,
    items: (row.items ?? []).map((item) => {
      const image = Array.isArray(item.images) ? item.images[0] : item.images;
      return {
        imageId: item.image_id,
        feeKrw: item.fee_krw,
        title: image?.title ?? null,
        assetId: image?.asset_id ?? null,
      };
    }),
  };
}

export async function GET(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const status = req.nextUrl.searchParams.get("status");
  const admin = createAdminClient();
  let query = admin
    .from("arweave_registration_fee_orders")
    .select(`
      id, photographer_id, toss_order_id, toss_payment_key, unit_fee_krw, image_count, amount_krw,
      status, billing_name, billing_email, created_at, paid_at, canceled_at, refunded_at, cancel_reason,
      photographer:profiles!photographer_id(full_name),
      items:arweave_registration_fee_order_items(image_id, fee_krw, images(title, asset_id))
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (status && ["pending", "paid", "failed", "canceled", "refunded"].includes(status)) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ orders: ((data ?? []) as FeeOrderRow[]).map(normalize) });
}

export async function POST(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const body = (await req.json().catch(() => null)) as
    | { action?: "cancel" | "refund"; feeOrderId?: string; reason?: string }
    | null;
  const action = body?.action;
  const feeOrderId = body?.feeOrderId;
  const reason = body?.reason?.trim() || null;
  if (!feeOrderId || (action !== "cancel" && action !== "refund")) {
    return NextResponse.json({ error: "feeOrderId and a valid action are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: order, error: orderError } = await admin
    .from("arweave_registration_fee_orders")
    .select("id, status, toss_payment_key, photographer_id")
    .eq("id", feeOrderId)
    .single();

  if (orderError || !order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: items } = await admin
    .from("arweave_registration_fee_order_items")
    .select("image_id")
    .eq("fee_order_id", feeOrderId);
  const imageIds = ((items ?? []) as { image_id: string }[]).map((item) => item.image_id);
  const now = new Date().toISOString();

  if (action === "cancel") {
    if (!canCancelFeeOrder(order.status)) {
      return NextResponse.json({ error: "결제 대기 중인 주문만 취소할 수 있습니다." }, { status: 409 });
    }
    const { error: updateError } = await admin
      .from("arweave_registration_fee_orders")
      .update({ status: "canceled", canceled_at: now, cancel_reason: reason })
      .eq("id", feeOrderId)
      .eq("status", "pending");
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    if (imageIds.length > 0) {
      await admin
        .from("images")
        .update({ proof_request_payment_status: "none", proof_request_fee_order_id: null })
        .in("id", imageIds)
        .eq("proof_request_fee_order_id", feeOrderId);
    }

    await Promise.all(
      imageIds.map((imageId) =>
        recordOnchainEvent(admin, {
          eventType: "proof_self_funded_fee_canceled",
          actorId: adminUser.id,
          imageId,
          metadata: { feeOrderId, reason },
        }),
      ),
    );
    return NextResponse.json({ ok: true, status: "canceled" });
  }

  // refund
  if (!canRefundFeeOrder(order.status)) {
    return NextResponse.json({ error: "결제 완료된 주문만 환불할 수 있습니다." }, { status: 409 });
  }

  if (order.toss_payment_key) {
    const cancelRes = await fetch(
      `https://api.tosspayments.com/v1/payments/${order.toss_payment_key}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(process.env.TOSS_SECRET_KEY + ":").toString("base64"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cancelReason: reason ?? "Arweave 셀프등록 수수료 환불" }),
      },
    );
    if (!cancelRes.ok) {
      const cancelData = await cancelRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: `Toss 환불 실패: ${cancelData?.message ?? cancelData?.code ?? cancelRes.status}` },
        { status: 502 },
      );
    }
  }

  const { error: updateError } = await admin
    .from("arweave_registration_fee_orders")
    .update({ status: "refunded", refunded_at: now, cancel_reason: reason })
    .eq("id", feeOrderId)
    .eq("status", "paid");
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  if (imageIds.length > 0) {
    await admin
      .from("images")
      .update({
        proof_request_payment_status: "refunded",
        proof_status: "not_registered",
        proof_requested_at: null,
        proof_request_fee_order_id: null,
      })
      .in("id", imageIds)
      .eq("proof_request_fee_order_id", feeOrderId)
      .in("proof_status", ["requested", "available"]);
  }

  await Promise.all(
    imageIds.map((imageId) =>
      recordOnchainEvent(admin, {
        eventType: "proof_self_funded_fee_refunded",
        actorId: adminUser.id,
        imageId,
        metadata: { feeOrderId, reason, paymentKey: order.toss_payment_key },
      }),
    ),
  );

  return NextResponse.json({ ok: true, status: "refunded" });
}
