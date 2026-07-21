import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAddress, type Address } from "viem";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateCommission, selectCommissionPolicy, type CommissionPolicy } from "@/lib/commerce/commission";
import { createClient } from "@/lib/supabase/server";
import { bigintToDecimalString, krwToUsdcAmount } from "@/lib/onchain/amounts";
import { createOnchainConfirmToken } from "@/lib/onchain/checkout-auth";
import { getOnchainServerConfig, isOnchainEnabled } from "@/lib/onchain/env";
import { recordOnchainEvent } from "@/lib/onchain/events";
import { orderBytes32 } from "@/lib/onchain/ids";
import { createStaticKrwUsdcQuote } from "@/lib/onchain/quote";
import { loadSubscriptionCoverageForCheckout } from "@/lib/subscription/checkout";

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
  title: string;
  storage_path_preview: string | null;
  storage_path_original: string | null;
  storage_path_full: string | null;
  original_filename: string | null;
  photographer_id: string | null;
  onchain_asset_id: `0x${string}` | null;
  proof_status: string | null;
  photographer: { wallet_address: string | null } | { wallet_address: string | null }[] | null;
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function profileWallet(photographer: ImageRow["photographer"]) {
  const profile = Array.isArray(photographer) ? photographer[0] : photographer;
  return profile?.wallet_address ?? null;
}

export async function POST(req: NextRequest) {
  if (!isOnchainEnabled()) {
    return NextResponse.json({ error: "Onchain checkout is disabled" }, { status: 503 });
  }

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

  const [
    { data: licenses, error: licenseError },
    { data: images, error: imageError },
    { data: policyRows, error: policyError },
  ] = await Promise.all([
    admin
      .from("license_types")
      .select("code, price_krw")
      .in("code", licenseCodes),
    admin
      .from("images")
      .select("id, asset_id, title, storage_path_preview, storage_path_original, storage_path_full, original_filename, photographer_id, onchain_asset_id, proof_status, photographer:profiles!photographer_id(wallet_address)")
      .in("id", imageIds)
      .eq("status", "approved")
      .eq("lifecycle_status", "active"),
    admin
      .from("commission_policies")
      .select("id, scope, rate, active, starts_at, ends_at, license_code, photographer_id, image_id")
      .eq("active", true),
  ]);

  if (licenseError) return NextResponse.json({ error: licenseError.message }, { status: 500 });
  if (imageError) return NextResponse.json({ error: imageError.message }, { status: 500 });
  if (policyError) return NextResponse.json({ error: policyError.message }, { status: 500 });

  const licenseMap = new Map((licenses as LicenseRow[] | null ?? []).map((license) => [license.code, license]));
  const imageMap = new Map((images as ImageRow[] | null ?? []).map((image) => [image.id, image]));
  const policies = ((policyRows ?? []) as CommissionPolicy[]).map((policy) => ({
    ...policy,
    rate: Number(policy.rate),
  }));
  const pricedItems: { id: string; license: string; priceKrw: number }[] = [];
  for (const item of normalizedItems) {
    const license = licenseMap.get(item.license);
    if (!license) return badRequest(`Invalid license: ${item.license}`);
    pricedItems.push({
      id: item.id!,
      license: item.license!,
      priceKrw: license.price_krw,
    });
  }
  const coverage = await loadSubscriptionCoverageForCheckout({
    admin,
    userId: user.id,
    items: pricedItems,
  });
  const quote = createStaticKrwUsdcQuote(config.usdcPerKrw);
  const orderItems = [];
  const assetIds: `0x${string}`[] = [];
  const photographers: Address[] = [];
  const grossAmounts: bigint[] = [];
  let subtotal = 0;

  for (const [index, item] of normalizedItems.entries()) {
    const coveredItem = coverage.items[index];
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

    const price = coveredItem.effectivePriceKrw;
    const commissionPolicy = selectCommissionPolicy({
      imageId: item.id,
      photographerId: image.photographer_id,
      licenseCode: item.license,
      policies,
    });
    const commission = calculateCommission(price, commissionPolicy.rate);
    const netKrw = commission.netKrw;
    const grossCryptoAmount = krwToUsdcAmount(price, quote.usdcPerKrw);
    const netCryptoAmount = krwToUsdcAmount(netKrw, quote.usdcPerKrw);
    subtotal += price;
    if (grossCryptoAmount > BigInt(0)) {
      grossAmounts.push(grossCryptoAmount);
      assetIds.push(image.onchain_asset_id);
      photographers.push(photographerAddress);
    }
    orderItems.push({
      image_id: item.id,
      license_code: item.license,
      price_krw: price,
      photographer_id: image.photographer_id,
      image_title_snapshot: image.title,
      image_asset_id_snapshot: image.asset_id,
      image_preview_path_snapshot: image.storage_path_preview,
      image_original_path_snapshot: image.storage_path_original ?? image.storage_path_full,
      image_original_filename_snapshot: image.original_filename,
      gross_krw: price,
      commission_rate: commission.commissionRate,
      commission_krw: commission.commissionKrw,
      net_krw: netKrw,
      crypto_gross_amount: bigintToDecimalString(grossCryptoAmount),
      crypto_net_amount: bigintToDecimalString(netCryptoAmount),
      subscription_id: coveredItem.subscriptionCovered ? coverage.subscriptionId : null,
      subscription_covered: coveredItem.subscriptionCovered,
      subscription_original_price_krw: coveredItem.subscriptionCovered ? coveredItem.originalPriceKrw : null,
      subscription_plan: coveredItem.subscriptionCovered ? coverage.subscriptionPlan : null,
    });
  }

  // Base USDC MVP settles only license proceeds onchain. VAT is not collected
  // through escrow until a dedicated tax/treasury leg is added.
  const vat = 0;
  const total = subtotal + vat;
  const cryptoAmount = grossAmounts.reduce((sum, amount) => sum + amount, BigInt(0));
  if (cryptoAmount === BigInt(0)) {
    return badRequest("All items are covered by subscription or free pricing. Use standard checkout completion.");
  }
  const tossOrderId = randomUUID();
  const contractOrderId = orderBytes32(tossOrderId);
  const confirmToken = createOnchainConfirmToken();

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
      onchain_confirm_token: confirmToken,
      onchain_quote_usdc_per_krw: quote.usdcPerKrw,
      onchain_quote_source: quote.source,
      onchain_quote_created_at: quote.createdAt,
      onchain_quote_expires_at: quote.expiresAt,
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

  await recordOnchainEvent(admin, {
    eventType: "checkout_prepare_created",
    actorId: user.id,
    orderId: order.id,
    chainId: config.chainId,
    metadata: {
      itemCount: orderItems.length,
      cryptoAmount: cryptoAmount.toString(),
      contractOrderId,
      buyerWalletAddress,
      quote,
      subscriptionCoverage: {
        coveredCount: coverage.coveredCount,
        remainingBeforeOrder: coverage.remainingBeforeOrder,
        remainingAfterOrder: coverage.remainingAfterOrder,
      },
    },
  });

  return NextResponse.json({
    orderDbId: order.id,
    contractOrderId,
    chainId: config.chainId,
    usdcAddress: config.usdcAddress,
    escrowAddress: config.escrowAddress,
    confirmToken,
    cryptoAmount: cryptoAmount.toString(),
    quote,
    assetIds,
    photographers,
    grossAmounts: grossAmounts.map((amount) => amount.toString()),
    subscriptionCoverage: coverage,
  });
}
