import { NextRequest, NextResponse } from "next/server";
import { decodeEventLog, getAddress, isHex, type Address, type Hex } from "viem";
import { bigintToDecimalString, krwToUsdcAmount } from "@/lib/onchain/amounts";
import { IMAGE_PARTNERS_ESCROW_ABI } from "@/lib/onchain/abi";
import { getOnchainServerConfig } from "@/lib/onchain/env";
import { getOnchainPublicClient } from "@/lib/onchain/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface CheckoutConfirmBody {
  orderDbId?: string;
  txHash?: string;
}

interface OrderRow {
  id: string;
  order_number: string;
  contract_order_id: Hex;
  buyer_wallet_address: string;
  status: string;
  payment_tx_hash: string | null;
  crypto_amount: number | string | null;
  crypto_decimals: number | null;
  crypto_status: string;
}

interface OrderItemRow {
  id: string;
  gross_krw: number;
  commission_krw: number;
  net_krw: number;
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function decimalToUnits(value: number | string, decimals: number) {
  const normalized = String(value).trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) throw new Error("Invalid decimal amount");

  const [whole, fraction = ""] = normalized.split(".");
  const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(`${whole}${paddedFraction}`.replace(/^0+/, "") || "0");
}

export async function POST(req: NextRequest) {
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
    .select("id, order_number, contract_order_id, buyer_wallet_address, status, payment_tx_hash, crypto_amount, crypto_decimals, crypto_status")
    .eq("id", orderDbId)
    .eq("payment_provider", "base_usdc")
    .single();

  if (error || !orderData) {
    return NextResponse.json({ error: error?.message ?? "Order not found" }, { status: 404 });
  }

  const order = orderData as OrderRow;
  if (order.status === "completed" && order.crypto_status === "confirmed") {
    if (order.payment_tx_hash && order.payment_tx_hash.toLowerCase() !== txHash.toLowerCase()) {
      return NextResponse.json({ error: "Order already completed with a different transaction" }, { status: 409 });
    }
    return NextResponse.json({ orderNumber: order.order_number, alreadyCompleted: true });
  }
  if (order.status !== "pending" || order.crypto_status !== "pending") {
    return NextResponse.json({ error: "Order is not pending" }, { status: 409 });
  }
  if (!order.contract_order_id || !order.buyer_wallet_address || order.crypto_amount === null) {
    return NextResponse.json({ error: "Order is missing onchain payment fields" }, { status: 409 });
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
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") return badRequest("Transaction failed");

  const escrowAddress = getAddress(config.escrowAddress);
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

  const cryptoDecimals = order.crypto_decimals ?? 6;
  const expectedAmount = decimalToUnits(order.crypto_amount, cryptoDecimals);
  if (purchaseEvent.args.grossAmount !== expectedAmount) {
    return badRequest("Gross amount mismatch");
  }

  const { data: updated, error: updateError } = await admin
    .from("orders")
    .update({
      status: "completed",
      payment_tx_hash: txHash,
      crypto_status: "confirmed",
      completed_at: new Date().toISOString(),
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
      return NextResponse.json({ orderNumber: completedOrder.order_number, alreadyCompleted: true });
    }

    return NextResponse.json({ error: "Order was already finalized" }, { status: 409 });
  }

  const { data: orderItems, error: orderItemsError } = await admin
    .from("order_items")
    .select("id, gross_krw, commission_krw, net_krw")
    .eq("order_id", orderDbId);

  if (orderItemsError) return NextResponse.json({ error: orderItemsError.message }, { status: 500 });

  const typedOrderItems = orderItems as OrderItemRow[] | null;
  if (typedOrderItems?.length) {
    const ledgerUpdates = await Promise.all(
      typedOrderItems.map((item) => {
        const claimableAmount = krwToUsdcAmount(item.net_krw, config.usdcPerKrw);

        return admin
          .from("earnings_ledger")
          .update({
            settlement_provider: "onchain_escrow",
            claim_status: "claimable",
            claimable_amount: bigintToDecimalString(claimableAmount, cryptoDecimals),
          })
          .eq("order_item_id", item.id);
      }),
    );

    const ledgerError = ledgerUpdates.find((result) => result.error)?.error;
    if (ledgerError) return NextResponse.json({ error: ledgerError.message }, { status: 500 });
  }

  return NextResponse.json({ orderNumber: updated.order_number });
}
