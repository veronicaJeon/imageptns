import { NextResponse } from "next/server";
import { getAddress } from "viem";
import { IMAGE_PARTNERS_ESCROW_ABI } from "@/lib/onchain/abi";
import { bigintToDecimalString } from "@/lib/onchain/amounts";
import {
  aggregateClaimableByPhotographer,
  compareClaimableAmounts,
  type ClaimableLedgerReconciliationRow,
} from "@/lib/onchain/claim-reconciliation";
import { getOnchainServerConfig } from "@/lib/onchain/env";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOnchainPendingAgeMinutes, isStaleOnchainPendingOrder } from "@/lib/onchain/reconciliation";
import { getOnchainPublicClient } from "@/lib/onchain/server";

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
  onchain_confirm_attempts: number | null;
  onchain_confirm_backoff_until: string | null;
  onchain_quote_usdc_per_krw: number | string | null;
  onchain_quote_source: string | null;
  onchain_quote_expires_at: string | null;
  order_items: OrderItemRow[] | null;
}

interface ClaimReconciliationRow {
  photographerId: string;
  walletAddress: string | null;
  rowCount: number;
  dbClaimableUsdc: string;
  contractClaimableUsdc: string | null;
  deltaUsdc: string | null;
  status: "matched" | "mismatch" | "missing_wallet" | "read_error" | "not_checked";
  error?: string;
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

async function buildClaimReconciliation(
  claimRows: ClaimableLedgerReconciliationRow[],
): Promise<{ rows: ClaimReconciliationRow[]; configured: boolean; error: string | null }> {
  const aggregates = aggregateClaimableByPhotographer(claimRows);

  let config;
  try {
    config = getOnchainServerConfig();
  } catch (error) {
    return {
      configured: false,
      error: error instanceof Error ? error.message : "Onchain configuration is unavailable",
      rows: aggregates.map((row) => ({
        photographerId: row.photographerId,
        walletAddress: row.walletAddress,
        rowCount: row.rowCount,
        dbClaimableUsdc: row.dbClaimableUsdc,
        contractClaimableUsdc: null,
        deltaUsdc: null,
        status: row.walletAddress ? "not_checked" : "missing_wallet",
      })),
    };
  }

  const publicClient = getOnchainPublicClient();
  const escrowAddress = getAddress(config.escrowAddress);
  const rows = await Promise.all(
    aggregates.map(async (row): Promise<ClaimReconciliationRow> => {
      if (!row.walletAddress) {
        return {
          photographerId: row.photographerId,
          walletAddress: null,
          rowCount: row.rowCount,
          dbClaimableUsdc: row.dbClaimableUsdc,
          contractClaimableUsdc: null,
          deltaUsdc: null,
          status: "missing_wallet",
        };
      }

      try {
        const contractClaimableUnits = await publicClient.readContract({
          address: escrowAddress,
          abi: IMAGE_PARTNERS_ESCROW_ABI,
          functionName: "claimable",
          args: [getAddress(row.walletAddress)],
        });
        const comparison = compareClaimableAmounts(row.dbClaimableUnits, contractClaimableUnits);
        return {
          photographerId: row.photographerId,
          walletAddress: row.walletAddress,
          rowCount: row.rowCount,
          dbClaimableUsdc: row.dbClaimableUsdc,
          contractClaimableUsdc: bigintToDecimalString(contractClaimableUnits),
          deltaUsdc: comparison.deltaUsdc,
          status: comparison.status,
        };
      } catch (error) {
        return {
          photographerId: row.photographerId,
          walletAddress: row.walletAddress,
          rowCount: row.rowCount,
          dbClaimableUsdc: row.dbClaimableUsdc,
          contractClaimableUsdc: null,
          deltaUsdc: null,
          status: "read_error",
          error: error instanceof Error ? error.message : "Unable to read contract claimable",
        };
      }
    }),
  );

  return { configured: true, error: null, rows };
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
        onchain_confirm_attempts, onchain_confirm_backoff_until,
        onchain_quote_usdc_per_krw, onchain_quote_source, onchain_quote_expires_at,
        order_items(id)
      `)
      .eq("payment_provider", "base_usdc")
      .in("crypto_status", ["pending", "failed"])
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("earnings_ledger")
      .select("photographer_id, claimable_amount, photographer:profiles!photographer_id(wallet_address)")
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
      confirmAttempts: order.onchain_confirm_attempts ?? 0,
      confirmBackoffUntil: order.onchain_confirm_backoff_until,
      quoteUsdcPerKrw: order.onchain_quote_usdc_per_krw,
      quoteSource: order.onchain_quote_source,
      quoteExpiresAt: order.onchain_quote_expires_at,
      itemCount: itemCount(order.order_items),
      ageMinutes,
      stale: order.crypto_status === "pending" && isStaleOnchainPendingOrder(order.created_at, now),
    };
  });

  const claimableRows = (claimRows ?? []) as unknown as ClaimableLedgerReconciliationRow[];
  const claimableUsdc = claimableRows.reduce((sum, row) => sum + (Number(row.claimable_amount) || 0), 0);
  const claimReconciliation = await buildClaimReconciliation(claimableRows);

  return NextResponse.json({
    summary: {
      pending: orders.filter((order) => order.cryptoStatus === "pending").length,
      stalePending: orders.filter((order) => order.stale).length,
      failed: orders.filter((order) => order.cryptoStatus === "failed").length,
      claimableRows: claimableRows.length,
      claimableUsdc,
      claimableMismatches: claimReconciliation.rows.filter((row) => row.status === "mismatch").length,
      claimableMissingWallets: claimReconciliation.rows.filter((row) => row.status === "missing_wallet").length,
      claimableReadErrors: claimReconciliation.rows.filter((row) => row.status === "read_error").length,
      contractReconciliationConfigured: claimReconciliation.configured,
    },
    orders,
    claimReconciliation: claimReconciliation.rows,
    contractReconciliationError: claimReconciliation.error,
  });
}
