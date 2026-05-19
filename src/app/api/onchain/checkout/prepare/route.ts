import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAddress, type Address } from "viem";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { bigintToDecimalString, krwToUsdcAmount } from "@/lib/onchain/amounts";
import { getOnchainServerConfig } from "@/lib/onchain/env";
import { orderBytes32 } from "@/lib/onchain/ids";

interface CartItemInput {
  id: string;
  license: string;
}

interface BillingInput {
  name?: string;
  email?: string;
  company?: string;
}

interface CheckoutPrepareBody {
  items?: CartItemInput[];
  billing?: BillingInput;
  buyerWalletAddress?: string;
}

interface LicenseRow {
  code: string;
  price_krw: number;
}

interface ImageRow {
  id: string;
  asset_id: string | null;
  photographer_id: string | null;
  onchain_asset_id: `0x${string}` | null;
  proof_status: string | null;
  photographer: { wallet_address: string | null } | { wallet_address: string | null }[] | null;
}

const COMMISSION_RATE = 0.2;

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function profileWallet(photographer: ImageRow["photographer"]) {
  const profile = Array.isArray(photographer) ? photographer[0] : photographer;
  return profile?.wallet_address ?? null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: CheckoutPrepareBody;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const items = body.items ?? [];
  if (!Array.isArray(items) || items.length === 0) return badRequest("No items");

  let buyerWalletAddress: Address;
  try {
    buyerWalletAddress = getAddress(body.buyerWalletAddress ?? "");
  } catch {
    return badRequest("buyerWalletAddress must be a valid EVM address");
  }

  const normalizedItems = items.map((item) => ({
    id: item.id?.trim(),
    license: item.license?.trim(),
  }));

  if (normalizedItems.some((item) => !item.id || !item.license)) {
    return badRequest("Each item requires id and license");
  }

  const billing = body.billing ?? {};
  if (!billing.name?.trim() || !billing.email?.trim()) {
    return badRequest("Billing name and email are required");
  }

  let config;
  try {
    config = getOnchainServerConfig();
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Onchain checkout is not configured" }, { status: 500 });
  }

  const admin = createAdminClient();
  const licenseCodes = [...new Set(normalizedItems.map((item) => item.license))];
  const imageIds = [...new Set(normalizedItems.map((item) => item.id))];

  const [{ data: licenses, error: licenseError }, { data: images, error: imageError }] = await Promise.all([
    admin
      .from("license_types")
      .select("code, price_krw")
      .in("code", licenseCodes),
    admin
      .from("images")
      .select("id, asset_id, photographer_id, onchain_asset_id, proof_status, photographer:profiles!photographer_id(wallet_address)")
      .in("id", imageIds)
      .eq("status", "approved"),
  ]);

  if (licenseError) return NextResponse.json({ error: licenseError.message }, { status: 500 });
  if (imageError) return NextResponse.json({ error: imageError.message }, { status: 500 });

  const licenseMap = new Map((licenses as LicenseRow[] | null ?? []).map((license) => [license.code, license]));
  const imageMap = new Map((images as ImageRow[] | null ?? []).map((image) => [image.id, image]));
  const orderItems = [];
  const assetIds: `0x${string}`[] = [];
  const photographers: Address[] = [];
  const grossKrwAmounts: number[] = [];
  let subtotal = 0;

  for (const item of normalizedItems) {
    const license = licenseMap.get(item.license);
    if (!license) return badRequest(`Invalid license: ${item.license}`);

    const image = imageMap.get(item.id);
    if (!image?.asset_id || image.proof_status !== "registered" || !image.onchain_asset_id) {
      return badRequest("All images must be approved and registered onchain");
    }
    if (!image.photographer_id) return badRequest("All images must have a photographer");

    let photographerAddress: Address;
    try {
      photographerAddress = getAddress(profileWallet(image.photographer) ?? "");
    } catch {
      return badRequest("Photographer wallet address is missing or invalid");
    }

    const price = license.price_krw;
    const commission = Math.round(price * COMMISSION_RATE);
    subtotal += price;
    grossKrwAmounts.push(price);
    assetIds.push(image.onchain_asset_id);
    photographers.push(photographerAddress);
    orderItems.push({
      image_id: item.id,
      license_code: item.license,
      price_krw: price,
      photographer_id: image.photographer_id,
      gross_krw: price,
      commission_rate: COMMISSION_RATE,
      commission_krw: commission,
      net_krw: price - commission,
    });
  }

  const vat = Math.round(subtotal * 0.1);
  const total = subtotal + vat;
  const grossAmounts = grossKrwAmounts.map((amount) => krwToUsdcAmount(amount, config.usdcPerKrw));
  const cryptoAmount = grossAmounts.reduce((sum, amount) => sum + amount, BigInt(0));
  const tossOrderId = randomUUID();
  const contractOrderId = orderBytes32(tossOrderId);

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      buyer_id: user.id,
      subtotal_krw: subtotal,
      vat_krw: vat,
      total_krw: total,
      billing_name: billing.name.trim(),
      billing_email: billing.email.trim(),
      billing_company: billing.company?.trim() || null,
      toss_order_id: tossOrderId,
      status: "pending",
      payment_provider: "base_usdc",
      chain_id: config.chainId,
      payment_token: config.usdcAddress,
      contract_order_id: contractOrderId,
      crypto_amount: bigintToDecimalString(cryptoAmount),
      crypto_decimals: 6,
      crypto_status: "pending",
      buyer_wallet_address: buyerWalletAddress,
    })
    .select("id")
    .single();

  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });

  const { error: itemsError } = await admin
    .from("order_items")
    .insert(orderItems.map((item) => ({ ...item, order_id: order.id })));

  if (itemsError) {
    await admin
      .from("orders")
      .update({ status: "failed", crypto_status: "failed" })
      .eq("id", order.id)
      .eq("status", "pending");
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  return NextResponse.json({
    orderDbId: order.id,
    contractOrderId,
    chainId: config.chainId,
    usdcAddress: config.usdcAddress,
    escrowAddress: config.escrowAddress,
    cryptoAmount: cryptoAmount.toString(),
    assetIds,
    photographers,
    grossAmounts: grossAmounts.map((amount) => amount.toString()),
  });
}
