import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireApprovedPhotographer } from "@/lib/photographers/approval";

interface FeeOrderItemRow {
  image_id: string;
  fee_krw: number;
  images: { title: string | null; asset_id: string | null } | { title: string | null; asset_id: string | null }[] | null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from("arweave_registration_fee_orders")
    .select("id, photographer_id, toss_order_id, toss_payment_key, unit_fee_krw, image_count, amount_krw, status, billing_name, billing_email, created_at, paid_at, canceled_at, refunded_at")
    .eq("id", id)
    .single();

  if (error || !order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin = Boolean(profile?.is_admin);

  if (order.photographer_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isAdmin) {
    const authorization = await requireApprovedPhotographer(admin, user.id);
    if (!authorization.ok) return authorization.response;
  }

  const { data: itemRows } = await admin
    .from("arweave_registration_fee_order_items")
    .select("image_id, fee_krw, images(title, asset_id)")
    .eq("fee_order_id", id);

  const items = ((itemRows ?? []) as FeeOrderItemRow[]).map((item) => {
    const image = Array.isArray(item.images) ? item.images[0] : item.images;
    return {
      imageId: item.image_id,
      feeKrw: item.fee_krw,
      title: image?.title ?? null,
      assetId: image?.asset_id ?? null,
    };
  });

  return NextResponse.json({
    order: {
      id: order.id,
      tossOrderId: order.toss_order_id,
      paymentKey: order.toss_payment_key,
      unitFeeKrw: order.unit_fee_krw,
      imageCount: order.image_count,
      amountKrw: order.amount_krw,
      status: order.status,
      billingName: order.billing_name,
      billingEmail: order.billing_email,
      createdAt: order.created_at,
      paidAt: order.paid_at,
      canceledAt: order.canceled_at,
      refundedAt: order.refunded_at,
    },
    items,
  });
}
