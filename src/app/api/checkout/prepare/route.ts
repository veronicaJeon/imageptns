import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";
import { calculateCommission, selectCommissionPolicy, type CommissionPolicy } from "@/lib/commerce/commission";
import { priceCartItemsFromLicenses, type LicensePriceRow } from "@/lib/commerce/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadSubscriptionCoverageForCheckout } from "@/lib/subscription/checkout";

interface CartItemInput {
  id: string;           // image id
  license: string;      // 'editorial' | 'commercial' | 'extended'
}

interface CheckoutImageRow {
  id: string;
  title: string;
  asset_id: string | null;
  photographer_id: string | null;
  storage_path_preview: string | null;
  storage_path_original: string | null;
  storage_path_full: string | null;
  original_filename: string | null;
  status: string;
  is_published: boolean | null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { items, billing }: { items?: CartItemInput[]; billing?: { name?: string; email?: string; company?: string } } =
    await req.json();

  if (!items?.length) return NextResponse.json({ error: "No items" }, { status: 400 });
  if (!billing?.name?.trim() || !billing.email?.trim()) {
    return NextResponse.json({ error: "Billing name and email are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const licenseCodes = [...new Set(items.map((item) => item.license))];
  const { data: licenses, error: licenseError } = await admin
    .from("license_types")
    .select("code, price_krw")
    .in("code", licenseCodes);

  if (licenseError) return NextResponse.json({ error: licenseError.message }, { status: 500 });

  let pricedItems;
  try {
    pricedItems = priceCartItemsFromLicenses(items, (licenses ?? []) as LicensePriceRow[]);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid license" }, { status: 400 });
  }

  const coverage = await loadSubscriptionCoverageForCheckout({
    admin,
    userId: user.id,
    items: pricedItems,
  });
  const payableItems = coverage.items;
  const subtotal = payableItems.reduce((s, i) => s + i.effectivePriceKrw, 0);
  const vat      = Math.round(subtotal * 0.1);
  const total    = subtotal + vat;
  const tossOrderId = randomUUID();

  // Create order (status: pending)
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      buyer_id:        user.id,
      subtotal_krw:    subtotal,
      vat_krw:         vat,
      total_krw:       total,
      billing_name:    billing.name,
      billing_email:   billing.email,
      billing_company: billing.company ?? null,
      toss_order_id:   tossOrderId,
      status:          "pending",
    })
    .select()
    .single();

  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });

  // Fetch image details for order items
  const imageIds = items.map((i) => i.id);
  const { data: images, error: imageError } = await admin
    .from("images")
    .select("id, title, asset_id, photographer_id, storage_path_preview, storage_path_original, storage_path_full, original_filename, status, is_published")
    .in("id", imageIds)
    .eq("status", "approved")
    .eq("lifecycle_status", "active")
    .eq("is_published", true);

  if (imageError) return NextResponse.json({ error: imageError.message }, { status: 500 });

  const imageRows = (images ?? []) as CheckoutImageRow[];
  const imageMap = Object.fromEntries(imageRows.map((img) => [img.id, img]));
  if (imageIds.some((id) => !imageMap[id])) {
    return NextResponse.json({ error: "현재 구매할 수 없는 이미지가 포함되어 있습니다." }, { status: 409 });
  }
  const { data: policyRows } = await admin
    .from("commission_policies")
    .select("id, scope, rate, active, starts_at, ends_at, license_code, photographer_id, image_id")
    .eq("active", true);
  const policies = ((policyRows ?? []) as CommissionPolicy[]).map((policy) => ({
    ...policy,
    rate: Number(policy.rate),
  }));

  const orderItems = payableItems.map((item) => {
    const img      = imageMap[item.id];
    const gross    = item.effectivePriceKrw;
    const commissionPolicy = selectCommissionPolicy({
      imageId: item.id,
      photographerId: img?.photographer_id ?? null,
      licenseCode: item.license,
      policies,
    });
    const commission = calculateCommission(gross, commissionPolicy.rate);
    return {
      order_id:        order.id,
      image_id:        item.id,
      license_code:    item.license,
      price_krw:       item.effectivePriceKrw,
      photographer_id: img?.photographer_id ?? null,
      image_title_snapshot: img?.title ?? null,
      image_asset_id_snapshot: img?.asset_id ?? null,
      image_preview_path_snapshot: img?.storage_path_preview ?? null,
      image_original_path_snapshot: img?.storage_path_original ?? img?.storage_path_full ?? null,
      image_original_filename_snapshot: img?.original_filename ?? null,
      gross_krw:       gross,
      commission_rate: commission.commissionRate,
      commission_krw:  commission.commissionKrw,
      net_krw:         commission.netKrw,
      subscription_id: item.subscriptionCovered ? coverage.subscriptionId : null,
      subscription_covered: item.subscriptionCovered,
      subscription_original_price_krw: item.subscriptionCovered ? item.originalPriceKrw : null,
      subscription_plan: item.subscriptionCovered ? coverage.subscriptionPlan : null,
    };
  });

  const { error: itemsError } = await admin.from("order_items").insert(orderItems);
  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });

  if (total === 0) {
    const { data: completedOrder, error: completeError } = await admin
      .from("orders")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .select("id, order_number")
      .single();

    if (completeError) return NextResponse.json({ error: completeError.message }, { status: 500 });

    return NextResponse.json({
      orderId: tossOrderId,
      orderDbId: completedOrder.id,
      orderNumber: completedOrder.order_number,
      amount: total,
      orderName: coverage.coveredCount > 0
        ? items.length === 1 ? `구독 무료다운 이미지 라이선스 (${items[0].license})` : `구독 무료다운 이미지 라이선스 외 ${items.length - 1}건`
        : items.length === 1 ? `무료 이미지 라이선스 (${items[0].license})` : `무료 이미지 라이선스 외 ${items.length - 1}건`,
      free: true,
      subscriptionCoverage: coverage,
    });
  }

  // Order name for Toss
  const firstName = items[0];
  const orderName =
    items.length === 1
      ? `이미지 라이선스 (${firstName.license})`
      : `이미지 라이선스 외 ${items.length - 1}건`;

  return NextResponse.json({
    orderId:   tossOrderId,
    orderDbId: order.id,
    amount:    total,
    orderName,
    subscriptionCoverage: coverage,
  });
}
