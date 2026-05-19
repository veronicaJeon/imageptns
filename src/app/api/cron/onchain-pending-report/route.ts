import { NextResponse } from "next/server";
import {
  ONCHAIN_PENDING_STALE_MINUTES,
  getOnchainPendingAgeMinutes,
  isStaleOnchainPendingOrder,
} from "@/lib/onchain/reconciliation";
import { authorizeCronRequest } from "@/lib/security/cron";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface PendingOnchainOrderRow {
  id: string;
  order_number: string | null;
  created_at: string;
  billing_email: string | null;
  crypto_amount: number | string | null;
  contract_order_id: string | null;
  buyer_wallet_address: string | null;
}

interface PendingOrderAgeRow {
  created_at: string;
}

export async function GET(request: Request) {
  const cronAuthorization = authorizeCronRequest(request.headers);
  if (!cronAuthorization.authorized) {
    return NextResponse.json({ error: cronAuthorization.error }, { status: cronAuthorization.status });
  }

  const admin = createAdminClient();
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - ONCHAIN_PENDING_STALE_MINUTES * 60_000).toISOString();
  const [totalResult, newestResult, oldestResult, staleResult] = await Promise.all([
    admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("payment_provider", "base_usdc")
      .eq("crypto_status", "pending"),
    admin
      .from("orders")
      .select("created_at")
      .eq("payment_provider", "base_usdc")
      .eq("crypto_status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("orders")
      .select("created_at")
      .eq("payment_provider", "base_usdc")
      .eq("crypto_status", "pending")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    admin
      .from("orders")
      .select(
        `
          id, order_number, created_at, billing_email,
          crypto_amount, contract_order_id, buyer_wallet_address
        `,
        { count: "exact" },
      )
      .eq("payment_provider", "base_usdc")
      .eq("crypto_status", "pending")
      .lte("created_at", staleCutoff)
      .order("created_at", { ascending: true })
      .limit(50),
  ]);

  const queryError = totalResult.error ?? newestResult.error ?? oldestResult.error ?? staleResult.error;
  if (queryError) {
    console.error("[onchain-pending-report] query error:", queryError.message);
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  const staleOrders = ((staleResult.data ?? []) as PendingOnchainOrderRow[])
    .filter((order) => isStaleOnchainPendingOrder(order.created_at, now))
    .map((order) => ({
      id: order.id,
      orderNumber: order.order_number,
      createdAt: order.created_at,
      billingEmail: order.billing_email,
      cryptoAmount: order.crypto_amount,
      contractOrderId: order.contract_order_id,
      buyerWalletAddress: order.buyer_wallet_address,
      ageMinutes: getOnchainPendingAgeMinutes(order.created_at, now),
    }));
  const newestOrder = newestResult.data as PendingOrderAgeRow | null;
  const oldestOrder = oldestResult.data as PendingOrderAgeRow | null;

  return NextResponse.json({
    summary: {
      totalPending: totalResult.count ?? 0,
      staleCount: staleResult.count ?? staleOrders.length,
      newestAgeMinutes: newestOrder ? getOnchainPendingAgeMinutes(newestOrder.created_at, now) : null,
      oldestAgeMinutes: oldestOrder ? getOnchainPendingAgeMinutes(oldestOrder.created_at, now) : null,
    },
    staleOrders,
  });
}
