import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

interface CartItemInput {
  id: string;           // image id
  license: string;      // 'editorial' | 'commercial' | 'extended'
  price: number;        // KRW
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { items, billing }: { items: CartItemInput[]; billing: { name: string; email: string; company?: string } } =
    await req.json();

  if (!items?.length) return NextResponse.json({ error: "No items" }, { status: 400 });

  const subtotal = items.reduce((s, i) => s + i.price, 0);
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

  const imageMap = Object.fromEntries((images ?? []).map((img: any) => [img.id, img]));

  const COMMISSION_RATE = 0.20;
  const orderItems = items.map((item) => {
    const img      = imageMap[item.id];
    const gross    = item.price;
    const commission = Math.round(gross * COMMISSION_RATE);
    return {
      order_id:        order.id,
      image_id:        item.id,
      license_code:    item.license,
      price_krw:       item.price,
      photographer_id: img?.photographer_id ?? null,
      gross_krw:       gross,
      commission_rate: COMMISSION_RATE,
      commission_krw:  commission,
      net_krw:         gross - commission,
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
