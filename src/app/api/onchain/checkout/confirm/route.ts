import { NextRequest, NextResponse } from "next/server";
import { decodeEventLog, decodeFunctionData, getAddress, isHex, type Address, type Hex } from "viem";
import { bigintToDecimalString } from "@/lib/onchain/amounts";
import { IMAGE_PARTNERS_ESCROW_ABI } from "@/lib/onchain/abi";
import { authorizeOnchainCheckoutConfirmation } from "@/lib/onchain/checkout-auth";
import { getConfirmAttemptDecision, getNextConfirmBackoffUntil } from "@/lib/onchain/confirm-attempts";
import { getOnchainServerConfig } from "@/lib/onchain/env";
import { recordOnchainEvent } from "@/lib/onchain/events";
import { imageAssetBytes32 } from "@/lib/onchain/ids";
import { getOnchainPublicClient } from "@/lib/onchain/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface CheckoutConfirmBody {
  orderDbId?: string;
  txHash?: string;
  confirmToken?: string;
}

interface OrderRow {
  id: string;
  order_number: string;
  buyer_id: string;
  contract_order_id: Hex;
  buyer_wallet_address: string;
  onchain_confirm_token: string | null;
  status: string;
  payment_tx_hash: string | null;
  crypto_amount: number | string | null;
  crypto_decimals: number | null;
  crypto_status: string;
  onchain_confirm_attempts: number | null;
  onchain_confirm_backoff_until: string | null;
  onchain_quote_expires_at: string | null;
}

interface ImageJoinRow {
  asset_id: string | null;
  onchain_asset_id: Hex | null;
  photographer: { wallet_address: string | null } | { wallet_address: string | null }[] | null;
}

interface ExpectedPurchaseItem {
  orderItemId: string;
  assetId: Hex;
  photographer: Address;
  grossAmount: bigint;
  claimableAmount: bigint;
}

interface OrderItemRow {
  id: string;
  gross_krw: number;
  commission_krw: number;
  net_krw: number;
  crypto_gross_amount: number | string | null;
  crypto_net_amount: number | string | null;
  image: ImageJoinRow | ImageJoinRow[] | null;
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function retryAfterResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    {
      error: "Too many confirmation attempts. Try again later.",
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}

function confirmAttemptReset() {
  return {
    onchain_confirm_attempts: 0,
    onchain_confirm_backoff_until: null,
  };
}

async function isAdminUser(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .single();

  if (error) return false;
  return Boolean(data?.is_admin);
}

function decimalToUnits(value: number | string, decimals: number) {
  const normalized = String(value).trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) throw new Error("Invalid decimal amount");

  const [whole, fraction = ""] = normalized.split(".");
  const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(`${whole}${paddedFraction}`.replace(/^0+/, "") || "0");
}

function orderItemImage(image: OrderItemRow["image"]) {
  return Array.isArray(image) ? image[0] : image;
}

function profileWallet(photographer: ImageJoinRow["photographer"]) {
  const profile = Array.isArray(photographer) ? photographer[0] : photographer;
  return profile?.wallet_address ?? null;
}

function purchaseItemKey(assetId: Hex, photographer: Address, amount: bigint) {
  return `${assetId.toLowerCase()}:${photographer.toLowerCase()}:${amount.toString()}`;
}

function toCountMap(keys: string[]) {
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return counts;
}

function equalCountMaps(left: Map<string, number>, right: Map<string, number>) {
  if (left.size !== right.size) return false;
  for (const [key, count] of left) {
    if (right.get(key) !== count) return false;
  }
  return true;
}

async function loadExpectedPurchaseItems(
  admin: ReturnType<typeof createAdminClient>,
  orderDbId: string,
) {
  const { data: orderItems, error } = await admin
    .from("order_items")
    .select(`
      id,
      gross_krw,
      commission_krw,
      net_krw,
      crypto_gross_amount,
      crypto_net_amount,
      image:images!image_id(
        asset_id,
        onchain_asset_id,
        photographer:profiles!photographer_id(wallet_address)
      )
    `)
    .eq("order_id", orderDbId);

  if (error) return { error };

  const expectedItems: ExpectedPurchaseItem[] = [];
  for (const item of (orderItems as unknown as OrderItemRow[] | null) ?? []) {
    const image = orderItemImage(item.image);
    const assetId = image?.onchain_asset_id ?? (image?.asset_id ? imageAssetBytes32(image.asset_id) : null);
    if (!assetId) return { response: NextResponse.json({ error: "Order item image is missing onchain asset id" }, { status: 409 }) };

    let photographer: Address;
    try {
      photographer = getAddress(profileWallet(image?.photographer ?? null) ?? "");
    } catch {
      return { response: NextResponse.json({ error: "Order item photographer wallet is missing or invalid" }, { status: 409 }) };
    }

    const grossAmount = decimalToUnits(item.crypto_gross_amount ?? "", 6);
    if (grossAmount === BigInt(0)) continue;

    expectedItems.push({
      orderItemId: item.id,
      assetId,
      photographer,
      grossAmount,
      claimableAmount: decimalToUnits(item.crypto_net_amount ?? "", 6),
    });
  }

  if (expectedItems.length === 0) {
    return { response: NextResponse.json({ error: "Order has no items" }, { status: 409 }) };
  }

  return { expectedItems };
}

async function updateLedgerClaimable(
  admin: ReturnType<typeof createAdminClient>,
  expectedItems: ExpectedPurchaseItem[],
  cryptoDecimals: number,
) {
  const ledgerUpdates = await Promise.all(
    expectedItems.map((item) =>
      admin
        .from("earnings_ledger")
        .update({
          settlement_provider: "onchain_escrow",
          claim_status: "claimable",
          claimable_amount: bigintToDecimalString(item.claimableAmount, cryptoDecimals),
        })
        .eq("order_item_id", item.orderItemId),
    ),
  );

  return ledgerUpdates.find((result) => result.error)?.error ?? null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let body: CheckoutConfirmBody;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const orderDbId = body.orderDbId?.trim();
  if (!orderDbId || !body.txHash || !isHex(body.txHash)) {
    return badRequest("orderDbId and txHash are required");
  }
  const txHash = body.txHash as Hex;

  const admin = createAdminClient();
  let config;
  try {
    config = getOnchainServerConfig();
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Onchain checkout is not configured" }, { status: 500 });
  }

  const { data: orderData, error } = await admin
    .from("orders")
    .select(`
      id, order_number, buyer_id, contract_order_id, buyer_wallet_address,
      onchain_confirm_token, status, payment_tx_hash, crypto_amount,
      crypto_decimals, crypto_status, onchain_confirm_attempts,
      onchain_confirm_backoff_until, onchain_quote_expires_at
    `)
    .eq("id", orderDbId)
    .eq("payment_provider", "base_usdc")
    .single();

  if (error || !orderData) {
    return NextResponse.json({ error: error?.message ?? "Order not found" }, { status: 404 });
  }

  const order = orderData as OrderRow;
  const buyerOrTokenAuthorized = authorizeOnchainCheckoutConfirmation({
    orderBuyerId: order.buyer_id,
    authenticatedUserId: user?.id ?? null,
    storedConfirmToken: order.onchain_confirm_token,
    providedConfirmToken: body.confirmToken ?? null,
  });
  const adminAuthorized = !buyerOrTokenAuthorized && user ? await isAdminUser(admin, user.id) : false;
  const authorized = buyerOrTokenAuthorized || adminAuthorized;
  if (!authorized) {
    return NextResponse.json(
      { error: user ? "Forbidden" : "Unauthorized" },
      { status: user ? 403 : 401 },
    );
  }

  if (order.status === "completed" && order.crypto_status === "confirmed") {
    if (order.payment_tx_hash && order.payment_tx_hash.toLowerCase() !== txHash.toLowerCase()) {
      return NextResponse.json({ error: "Order already completed with a different transaction" }, { status: 409 });
    }
  } else if (order.status !== "pending" || order.crypto_status !== "pending") {
    return NextResponse.json({ error: "Order is not pending" }, { status: 409 });
  }
  if (!order.contract_order_id || !order.buyer_wallet_address || order.crypto_amount === null) {
    return NextResponse.json({ error: "Order is missing onchain payment fields" }, { status: 409 });
  }

  if (order.status === "pending" && order.crypto_status === "pending") {
    const now = new Date();
    const attemptDecision = getConfirmAttemptDecision(
      { backoffUntil: order.onchain_confirm_backoff_until },
      now,
    );
    if (!attemptDecision.allowed) return retryAfterResponse(attemptDecision.retryAfterSeconds);

    const attemptsAfterThisRequest = (order.onchain_confirm_attempts ?? 0) + 1;
    const { error: attemptError } = await admin
      .from("orders")
      .update({
        onchain_confirm_attempts: attemptsAfterThisRequest,
        onchain_confirm_last_attempt_at: now.toISOString(),
        onchain_confirm_backoff_until: getNextConfirmBackoffUntil(attemptsAfterThisRequest, now).toISOString(),
      })
      .eq("id", orderDbId);

    if (attemptError) return NextResponse.json({ error: attemptError.message }, { status: 500 });
  }

  const { data: reusedTxOrder, error: reusedTxError } = await admin
    .from("orders")
    .select("id")
    .eq("payment_tx_hash", txHash)
    .neq("id", orderDbId)
    .maybeSingle();

  if (reusedTxError) return NextResponse.json({ error: reusedTxError.message }, { status: 500 });
  if (reusedTxOrder) return NextResponse.json({ error: "Transaction hash is already used" }, { status: 409 });

  let buyerWalletAddress: Address;
  try {
    buyerWalletAddress = getAddress(order.buyer_wallet_address);
  } catch {
    return NextResponse.json({ error: "Order buyer wallet address is invalid" }, { status: 409 });
  }

  const publicClient = getOnchainPublicClient();
  const escrowAddress = getAddress(config.escrowAddress);
  const cryptoDecimals = order.crypto_decimals ?? 6;
  const expectedAmount = decimalToUnits(order.crypto_amount, cryptoDecimals);
  const expectedPurchase = await loadExpectedPurchaseItems(admin, orderDbId);
  if (expectedPurchase.error) return NextResponse.json({ error: expectedPurchase.error.message }, { status: 500 });
  if (expectedPurchase.response) return expectedPurchase.response;
  const expectedItems = expectedPurchase.expectedItems;
  const expectedGrossAmount = expectedItems.reduce((sum, item) => sum + item.grossAmount, BigInt(0));
  if (expectedGrossAmount !== expectedAmount) {
    return NextResponse.json({ error: "Stored crypto amount does not match order items" }, { status: 409 });
  }

  const transaction = await publicClient.getTransaction({ hash: txHash });
  if (!transaction.to || getAddress(transaction.to) !== escrowAddress) {
    return badRequest("Transaction was not sent to escrow contract");
  }

  let decodedFunction;
  try {
    decodedFunction = decodeFunctionData({
      abi: IMAGE_PARTNERS_ESCROW_ABI,
      data: transaction.input,
    });
  } catch {
    return badRequest("Transaction calldata is not a recognized escrow call");
  }

  if (decodedFunction.functionName !== "purchase") {
    return badRequest("Transaction is not a purchase call");
  }

  const [calldataOrderId, calldataAssetIds, calldataPhotographers, calldataGrossAmounts] =
    decodedFunction.args as readonly [Hex, readonly Hex[], readonly Address[], readonly bigint[]];
  if (calldataOrderId !== order.contract_order_id) return badRequest("Calldata order id mismatch");

  const expectedKeys = toCountMap(
    expectedItems.map((item) => purchaseItemKey(item.assetId, item.photographer, item.grossAmount)),
  );
  if (
    calldataAssetIds.length !== calldataPhotographers.length ||
    calldataAssetIds.length !== calldataGrossAmounts.length
  ) {
    return badRequest("Purchase calldata does not match order items");
  }

  let actualKeys: Map<string, number>;
  try {
    actualKeys = toCountMap(
      calldataAssetIds.map((assetId, index) =>
        purchaseItemKey(assetId, getAddress(calldataPhotographers[index]), calldataGrossAmounts[index]),
      ),
    );
  } catch {
    return badRequest("Purchase calldata does not match order items");
  }

  if (!equalCountMaps(expectedKeys, actualKeys)) return badRequest("Purchase calldata does not match order items");

  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") return badRequest("Transaction failed");

  const purchaseEvents = receipt.logs.flatMap((log) => {
    if (getAddress(log.address) !== escrowAddress) return [];

    try {
      const event = decodeEventLog({
        abi: IMAGE_PARTNERS_ESCROW_ABI,
        data: log.data,
        topics: log.topics,
      });

      return event.eventName === "PurchaseCompleted" ? [event] : [];
    } catch {
      return [];
    }
  });

  const purchaseEvent = purchaseEvents.find((event) => event.args.orderId === order.contract_order_id);
  if (!purchaseEvent) return badRequest("PurchaseCompleted event missing");

  if (getAddress(purchaseEvent.args.buyer) !== buyerWalletAddress) {
    return badRequest("Buyer mismatch");
  }

  if (purchaseEvent.args.grossAmount !== expectedAmount) {
    return badRequest("Gross amount mismatch");
  }

  if (order.status === "completed" && order.crypto_status === "confirmed") {
    const ledgerError = await updateLedgerClaimable(admin, expectedItems, cryptoDecimals);
    if (ledgerError) return NextResponse.json({ error: ledgerError.message }, { status: 500 });
    await admin.from("orders").update(confirmAttemptReset()).eq("id", orderDbId);

    await recordOnchainEvent(admin, {
      eventType: "checkout_confirmed",
      actorId: user?.id ?? null,
      orderId: orderDbId,
      txHash,
      chainId: config.chainId,
      metadata: {
        orderNumber: order.order_number,
        alreadyCompleted: true,
        confirmedByAdmin: adminAuthorized,
        itemCount: expectedItems.length,
        grossAmount: expectedAmount.toString(),
      },
    });

    return NextResponse.json({ orderNumber: order.order_number, alreadyCompleted: true });
  }

  const { data: updated, error: updateError } = await admin
    .from("orders")
    .update({
      status: "completed",
      payment_tx_hash: txHash,
      crypto_status: "confirmed",
      completed_at: new Date().toISOString(),
      ...confirmAttemptReset(),
    })
    .eq("id", orderDbId)
    .eq("status", "pending")
    .eq("crypto_status", "pending")
    .is("payment_tx_hash", null)
    .select("id, order_number")
    .maybeSingle();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  if (!updated) {
    const { data: completedOrder } = await admin
      .from("orders")
      .select("order_number, payment_tx_hash, status, crypto_status")
      .eq("id", orderDbId)
      .single();

    if (
      completedOrder?.status === "completed" &&
      completedOrder.crypto_status === "confirmed" &&
      completedOrder.payment_tx_hash?.toLowerCase() === txHash.toLowerCase()
    ) {
      const ledgerError = await updateLedgerClaimable(admin, expectedItems, cryptoDecimals);
      if (ledgerError) return NextResponse.json({ error: ledgerError.message }, { status: 500 });
      await admin.from("orders").update(confirmAttemptReset()).eq("id", orderDbId);

      await recordOnchainEvent(admin, {
        eventType: "checkout_confirmed",
        actorId: user?.id ?? null,
        orderId: orderDbId,
        txHash,
        chainId: config.chainId,
        metadata: {
          orderNumber: completedOrder.order_number,
          alreadyCompleted: true,
          confirmedByAdmin: adminAuthorized,
          itemCount: expectedItems.length,
          grossAmount: expectedAmount.toString(),
        },
      });

      return NextResponse.json({ orderNumber: completedOrder.order_number, alreadyCompleted: true });
    }

    return NextResponse.json({ error: "Order was already finalized" }, { status: 409 });
  }

  const ledgerError = await updateLedgerClaimable(admin, expectedItems, cryptoDecimals);
  if (ledgerError) return NextResponse.json({ error: ledgerError.message }, { status: 500 });

  await recordOnchainEvent(admin, {
    eventType: "checkout_confirmed",
    actorId: user?.id ?? null,
    orderId: orderDbId,
    txHash,
    chainId: config.chainId,
    metadata: {
      orderNumber: updated.order_number,
      alreadyCompleted: false,
      confirmedByAdmin: adminAuthorized,
      itemCount: expectedItems.length,
      grossAmount: expectedAmount.toString(),
    },
  });

  return NextResponse.json({ orderNumber: updated.order_number });
}
