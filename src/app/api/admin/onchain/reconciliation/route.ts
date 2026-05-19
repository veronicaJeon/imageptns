import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOnchainPendingAgeMinutes, isStaleOnchainPendingOrder } from "@/lib/onchain/reconciliation";

interface OrderItemRow {
  id: string;
}

interface ReconciliationOrderRow {
  id: string;
  order_number: string | null;
  created_at: string;
  billing_email: string | null;
  total_krw: number | null;
  chain_id: number | null;
  payment_token: string | null;
  payment_tx_hash: string | null;
  contract_order_id: string | null;
  crypto_amount: number | string | null;
  crypto_status: string;
  buyer_wallet_address: string | null;
  order_items: OrderItemRow[] | null;
}

interface ClaimableLedgerRow {
  claimable_amount: number | string | null;
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  return profile?.is_admin ? user : null;
}

function itemCount(orderItems: OrderItemRow[] | null) {
  return Array.isArray(orderItems) ? orderItems.length : 0;
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const [{ data: orderRows, error: ordersError }, { data: claimRows, error: claimError }] = await Promise.all([
    admin
      .from("orders")
      .select(`
        id, order_number, created_at, billing_email, total_krw,
        chain_id, payment_token, payment_tx_hash, contract_order_id,
        crypto_amount, crypto_status, buyer_wallet_address,
        order_items(id)
      `)
      .eq("payment_provider", "base_usdc")
      .in("crypto_status", ["pending", "failed"])
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("earnings_ledger")
      .select("claimable_amount")
      .eq("settlement_provider", "onchain_escrow")
      .eq("claim_status", "claimable"),
  ]);

  if (ordersError) return NextResponse.json({ error: ordersError.message }, { status: 500 });
  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 });

  const now = new Date();
  const orders = ((orderRows ?? []) as unknown as ReconciliationOrderRow[]).map((order) => {
    const ageMinutes = getOnchainPendingAgeMinutes(order.created_at, now);
    return {
      id: order.id,
      orderNumber: order.order_number,
      createdAt: order.created_at,
      billingEmail: order.billing_email,
      totalKrw: order.total_krw ?? 0,
      chainId: order.chain_id,
      paymentToken: order.payment_token,
      paymentTxHash: order.payment_tx_hash,
      contractOrderId: order.contract_order_id,
      cryptoAmount: order.crypto_amount,
      cryptoStatus: order.crypto_status,
      buyerWalletAddress: order.buyer_wallet_address,
      itemCount: itemCount(order.order_items),
      ageMinutes,
      stale: order.crypto_status === "pending" && isStaleOnchainPendingOrder(order.created_at, now),
    };
  });

  const claimableRows = (claimRows ?? []) as ClaimableLedgerRow[];
  const claimableUsdc = claimableRows.reduce((sum, row) => sum + (Number(row.claimable_amount) || 0), 0);

  return NextResponse.json({
    summary: {
      pending: orders.filter((order) => order.cryptoStatus === "pending").length,
      stalePending: orders.filter((order) => order.stale).length,
      failed: orders.filter((order) => order.cryptoStatus === "failed").length,
      claimableRows: claimableRows.length,
      claimableUsdc,
    },
    orders,
  });
}
