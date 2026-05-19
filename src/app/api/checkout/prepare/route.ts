import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";
import { calculateCommission, selectCommissionPolicy, type CommissionPolicy } from "@/lib/commerce/commission";
import { priceCartItemsFromLicenses, type LicensePriceRow } from "@/lib/commerce/pricing";
import { createAdminClient } from "@/lib/supabase/admin";

interface CartItemInput {
  id: string;           // image id
  license: string;      // 'editorial' | 'commercial' | 'extended'
  price: number;        // KRW
}

interface CheckoutImageRow {
  id: string;
  photographer_id: string | null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { items, billing }: { items: CartItemInput[]; billing: { name: string; email: string; company?: string } } =
    await req.json();

  if (!items?.length) return NextResponse.json({ error: "No items" }, { status: 400 });

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

  const subtotal = pricedItems.reduce((s, i) => s + i.priceKrw, 0);
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
  const { data: images } = await supabase
    .from("images")
    .select("id, photographer_id")
    .in("id", imageIds);

  const imageRows = (images ?? []) as CheckoutImageRow[];
  const imageMap = Object.fromEntries(imageRows.map((img) => [img.id, img]));
  const { data: policyRows } = await admin
    .from("commission_policies")
    .select("id, scope, rate, active, starts_at, ends_at, license_code, photographer_id, image_id")
    .eq("active", true);
  const policies = ((policyRows ?? []) as CommissionPolicy[]).map((policy) => ({
    ...policy,
    rate: Number(policy.rate),
  }));

  const orderItems = pricedItems.map((item) => {
    const img      = imageMap[item.id];
    const gross    = item.priceKrw;
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
      price_krw:       item.priceKrw,
      photographer_id: img?.photographer_id ?? null,
      gross_krw:       gross,
      commission_rate: commission.commissionRate,
      commission_krw:  commission.commissionKrw,
      net_krw:         commission.netKrw,
    };
  });

  const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });

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
  });
}
