import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";
import { calculateCommission, selectCommissionPolicy, type CommissionPolicy } from "@/lib/commerce/commission";
import { priceCartItemsFromLicenses, type LicensePriceRow } from "@/lib/commerce/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadSubscriptionCoverageForCheckout } from "@/lib/subscription/checkout";
import { getBankTransferAccount } from "@/lib/payments/bank-transfer";

interface CartItemInput {
  id: string;           // image id
  license: string;      // 'editorial' | 'commercial' | 'extended'
}

type CheckoutPaymentProvider = "toss" | "bank_transfer";

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
  free_usage_policy: string | null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { items, billing, paymentProvider = "toss", usagePurposeNote }: {
    items?: CartItemInput[];
    billing?: { name?: string; email?: string; company?: string };
    paymentProvider?: CheckoutPaymentProvider;
    usagePurposeNote?: string | null;
  } =
    await req.json();

  if (!items?.length) return NextResponse.json({ error: "No items" }, { status: 400 });
  if (paymentProvider !== "toss" && paymentProvider !== "bank_transfer") {
    return NextResponse.json({ error: "Unsupported payment provider" }, { status: 400 });
  }
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

  const imageIds = items.map((i) => i.id);
  const { data: images, error: imageError } = await admin
    .from("images")
    .select("id, title, asset_id, photographer_id, storage_path_preview, storage_path_original, storage_path_full, original_filename, status, is_published, free_usage_policy")
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

  const { data: priceOverrides, error: overrideError } = await admin
    .from("image_price_overrides")
    .select("image_id, license_code, price_krw")
    .in("image_id", imageIds)
    .in("license_code", licenseCodes);

  if (overrideError) return NextResponse.json({ error: overrideError.message }, { status: 500 });

  let pricedItems;
  try {
    pricedItems = priceCartItemsFromLicenses(items, (licenses ?? []) as LicensePriceRow[], priceOverrides ?? []);
    pricedItems = pricedItems.map((item) => {
      const policy = imageMap[item.id]?.free_usage_policy;
      if (policy === "all") return { ...item, priceKrw: 0 };
      if (policy === "education" && item.license === "editorial") return { ...item, priceKrw: 0 };
      return item;
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid license" }, { status: 400 });
  }

  const normalizedUsagePurposeNote = typeof usagePurposeNote === "string"
    ? usagePurposeNote.trim().slice(0, 1000)
    : "";

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
  const isBankTransfer = paymentProvider === "bank_transfer";
  const requiresUsagePurpose = payableItems.some((item) => {
    const policy = imageMap[item.id]?.free_usage_policy;
    return item.effectivePriceKrw === 0 && item.license === "editorial" && (policy === "all" || policy === "education");
  });

  if (requiresUsagePurpose && !normalizedUsagePurposeNote) {
    return NextResponse.json({ error: "무료 에디토리얼/교육용 사용처를 입력해주세요." }, { status: 400 });
  }

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
      usage_purpose_note: normalizedUsagePurposeNote || null,
      toss_order_id:   tossOrderId,
      payment_provider: paymentProvider,
      status:          "pending",
      offline_payment_status: isBankTransfer ? "requested" : "not_applicable",
      offline_payment_requested_at: isBankTransfer ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });

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

  if (isBankTransfer) {
    return NextResponse.json({
      orderId: tossOrderId,
      orderDbId: order.id,
      orderNumber: order.order_number,
      amount: total,
      orderName: items.length === 1 ? `계좌결제 이미지 라이선스 (${items[0].license})` : `계좌결제 이미지 라이선스 외 ${items.length - 1}건`,
      bankTransfer: {
        status: "requested",
        account: getBankTransferAccount(),
      },
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
